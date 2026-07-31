//! Dynamic SVG artwork for daily streak announcements.
//!
//! The card is intentionally generated at send time instead of stored as a bitmap: the same
//! layout can show the member's current avatar, name and tier without keeping any user image on
//! disk. Discord renders SVG attachments inline and the fallback is a plain white avatar circle.

use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::STANDARD};

use crate::streak_style::{flame_color_for_streak, next_flame_milestone};

const MAX_AVATAR_BYTES: usize = 1_000_000;

/// Downloads a Discord CDN avatar for one card and embeds it as a bounded data URL.
///
/// A failed or oversized fetch is deliberately non-fatal: the card still contains the approved
/// white profile placeholder, so a CDN hiccup cannot suppress a streak announcement.
pub(crate) async fn fetch_avatar_data_url(avatar_url: Option<&str>) -> Option<String> {
    let avatar_url = avatar_url?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok()?;
    let response = client.get(avatar_url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    if response
        .content_length()
        .is_some_and(|length| length as usize > MAX_AVATAR_BYTES)
    {
        return None;
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .filter(|value| matches!(*value, "image/png" | "image/jpeg" | "image/webp"))
        .unwrap_or("image/png")
        .to_owned();
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > MAX_AVATAR_BYTES {
        return None;
    }
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

/// Builds the approved wide streak card as an inline SVG attachment.
#[must_use]
pub(crate) fn build_streak_card(
    display_name: &str,
    streak_days: i64,
    avatar_data_url: Option<&str>,
) -> Vec<u8> {
    let name = escape_xml(&display_name.chars().take(24).collect::<String>());
    let name = if name.trim().is_empty() {
        "Vozen user".to_owned()
    } else {
        name
    };
    let current_color = flame_color_for_streak(streak_days);
    let next_milestone = next_flame_milestone(streak_days);
    let next_color = flame_color_for_streak(next_milestone);
    let avatar = avatar_data_url
        .map(|url| {
            format!(
                r#"<image href="{}" x="518" y="18" width="164" height="164" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>"#,
                escape_xml(url)
            )
        })
        .unwrap_or_else(|| r##"<circle cx="600" cy="100" r="82" fill="#ffffff"/>"##.to_owned());

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680" role="img" aria-label="{name} {streak_days} day streak">
  <defs>
    <clipPath id="avatarClip"><circle cx="600" cy="100" r="82"/></clipPath>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="1200" height="680" rx="26" fill="#071522"/>
  <rect x="58" y="104" width="1084" height="500" rx="22" fill="#0d1b2a" stroke="#516072" stroke-width="2"/>
  <rect x="70" y="116" width="1060" height="476" rx="16" fill="none" stroke="#203248" stroke-width="1"/>
  <circle cx="600" cy="100" r="90" fill="#071522" stroke="#516072" stroke-width="2"/>
  {avatar}
  <text x="600" y="238" text-anchor="middle" fill="#f7f9fc" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700" letter-spacing="1.4">{name}</text>
  <line x1="600" y1="276" x2="600" y2="548" stroke="#506071" stroke-width="2"/>

  <g transform="translate(350 400)">
    <path d="M0 86C-51 75-61 30-13-10C-18 26 8 34 23 8C30 35 57 48 43 76C36 89 18 96 0 86Z" fill="{current_color}"/>
    <path d="M0 70C-17 64-25 47-6 27C-4 44 10 47 17 33C22 50 25 60 14 68C10 71 5 72 0 70Z" fill="#fff3d6" opacity="0.86"/>
    <text x="0" y="175" text-anchor="middle" fill="#45d6dc" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="800">{streak_days}</text>
    <text x="0" y="218" text-anchor="middle" fill="#f7f9fc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="5">DAY STREAK</text>
  </g>

  <g transform="translate(850 350)">
    <text x="0" y="0" text-anchor="middle" fill="#d9dee7" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700" letter-spacing="3">NEXT COLOR</text>
    <path d="M0 92C-51 81-61 36-13-4C-18 32 8 40 23 14C30 41 57 54 43 82C36 95 18 102 0 92Z" fill="{next_color}"/>
    <path d="M0 76C-17 70-25 53-6 33C-4 50 10 53 17 39C22 56 25 66 14 74C10 77 5 78 0 76Z" fill="#ffffff" opacity="0.72"/>
    <text x="0" y="168" text-anchor="middle" fill="#d9dee7" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700">AT <tspan fill="{next_color}" font-size="44">{next_milestone}</tspan> DAYS</text>
  </g>
</svg>"##
    )
    .into_bytes()
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::build_streak_card;

    #[test]
    fn card_contains_the_current_and_next_tier_without_a_milestone_row() {
        let svg = String::from_utf8(build_streak_card("Micon & Co", 42, None)).expect("svg");
        assert!(svg.contains("Micon &amp; Co"));
        assert!(svg.contains("DAY STREAK"));
        assert!(svg.contains("NEXT COLOR"));
        assert!(svg.contains("AT <tspan"));
        assert!(svg.contains("60</tspan> DAYS"));
        assert!(svg.contains("fill=\"#9b6cff\""));
        assert!(!svg.contains("30</text>"));
        assert!(svg.contains("fill=\"#ffffff\""));
    }
}
