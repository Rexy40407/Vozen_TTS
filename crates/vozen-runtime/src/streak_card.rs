//! Dynamic artwork for daily streak announcements.
//!
//! The approved layout is assembled as SVG and rasterized to PNG before it is sent to Discord.
//! Discord does not render SVG attachments as inline images, so the SVG never leaves this module.

use std::{
    sync::{Arc, OnceLock},
    time::Duration,
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use resvg::usvg;

use crate::streak_style::{flame_color_for_streak, next_flame_milestone};

const MAX_AVATAR_BYTES: usize = 1_000_000;
const CARD_WIDTH: u32 = 1200;
const CARD_HEIGHT: u32 = 680;
const CARD_AVATAR_SIZE: u16 = 256;

/// Keeps Discord's avatar download small and static before it enters the bounded card fetch.
#[must_use]
pub(crate) fn card_avatar_url(url: &str) -> String {
    let base = url.split_once('?').map_or(url, |(base, _)| base);
    format!("{base}?size={CARD_AVATAR_SIZE}")
}

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
        .and_then(|value| value.split(';').next())
        .filter(|value| matches!(*value, "image/png" | "image/jpeg" | "image/webp"))
        .unwrap_or("image/png")
        .to_owned();
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > MAX_AVATAR_BYTES {
        return None;
    }
    Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

/// Builds the approved wide streak card as a Discord-compatible PNG attachment.
#[must_use]
pub(crate) fn build_streak_card(
    display_name: &str,
    streak_days: i64,
    avatar_data_url: Option<&str>,
) -> Option<Vec<u8>> {
    rasterize_streak_card_svg(&build_streak_card_svg(
        display_name,
        streak_days,
        avatar_data_url,
    ))
    .or_else(|| {
        avatar_data_url.and_then(|_| {
            rasterize_streak_card_svg(&build_streak_card_svg(display_name, streak_days, None))
        })
    })
}

fn rasterize_streak_card_svg(svg: &str) -> Option<Vec<u8>> {
    let mut options = usvg::Options::default();
    options.fontdb = Arc::clone(card_font_database());
    let tree = usvg::Tree::from_str(svg, &options).ok()?;
    let size = tree.size().to_int_size();
    if size.width() != CARD_WIDTH || size.height() != CARD_HEIGHT {
        return None;
    }

    let mut pixmap = resvg::tiny_skia::Pixmap::new(CARD_WIDTH, CARD_HEIGHT)?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixmap.as_mut(),
    );
    pixmap.encode_png().ok()
}

fn card_font_database() -> &'static Arc<usvg::fontdb::Database> {
    static FONT_DATABASE: OnceLock<Arc<usvg::fontdb::Database>> = OnceLock::new();

    FONT_DATABASE.get_or_init(|| {
        let mut database = usvg::fontdb::Database::new();
        database.load_system_fonts();
        Arc::new(database)
    })
}

fn build_streak_card_svg(
    display_name: &str,
    streak_days: i64,
    avatar_data_url: Option<&str>,
) -> String {
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
  <text x="600" y="238" text-anchor="middle" fill="#f7f9fc" font-family="DejaVu Sans, sans-serif" font-size="31" font-weight="700" letter-spacing="1.4">{name}</text>
  <line x1="600" y1="276" x2="600" y2="548" stroke="#506071" stroke-width="2"/>

  <g transform="translate(350 400)">
    <path d="M0 86C-51 75-61 30-13-10C-18 26 8 34 23 8C30 35 57 48 43 76C36 89 18 96 0 86Z" fill="{current_color}"/>
    <path d="M0 70C-17 64-25 47-6 27C-4 44 10 47 17 33C22 50 25 60 14 68C10 71 5 72 0 70Z" fill="#fff3d6" opacity="0.86"/>
    <text x="0" y="175" text-anchor="middle" fill="#45d6dc" font-family="DejaVu Sans, sans-serif" font-size="112" font-weight="800">{streak_days}</text>
    <text x="0" y="218" text-anchor="middle" fill="#f7f9fc" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="700" letter-spacing="5">DAY STREAK</text>
  </g>

  <g transform="translate(850 350)">
    <text x="0" y="0" text-anchor="middle" fill="#d9dee7" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="700" letter-spacing="3">NEXT COLOR</text>
    <path d="M0 92C-51 81-61 36-13-4C-18 32 8 40 23 14C30 41 57 54 43 82C36 95 18 102 0 92Z" fill="{next_color}"/>
    <path d="M0 76C-17 70-25 53-6 33C-4 50 10 53 17 39C22 56 25 66 14 74C10 77 5 78 0 76Z" fill="#ffffff" opacity="0.72"/>
    <text x="0" y="168" text-anchor="middle" fill="#d9dee7" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="700">AT <tspan fill="{next_color}" font-size="44">{next_milestone}</tspan> DAYS</text>
  </g>
</svg>"##
    )
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
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    use super::{build_streak_card, build_streak_card_svg, card_avatar_url};

    fn decode_card(png: &[u8]) -> resvg::tiny_skia::Pixmap {
        resvg::tiny_skia::Pixmap::decode_png(png).expect("decoded card")
    }

    #[test]
    fn card_contains_the_current_and_next_tier_without_a_milestone_row() {
        let svg = build_streak_card_svg("Micon & Co", 42, None);
        assert!(svg.contains("Micon &amp; Co"));
        assert!(svg.contains("DAY STREAK"));
        assert!(svg.contains("NEXT COLOR"));
        assert!(svg.contains("AT <tspan"));
        assert!(svg.contains("60</tspan> DAYS"));
        assert!(svg.contains("fill=\"#9b6cff\""));
        assert!(!svg.contains("30</text>"));
        assert!(svg.contains("fill=\"#ffffff\""));
    }

    #[test]
    fn card_rasterizes_to_a_fixed_size_png() {
        let png = build_streak_card("Micon & Co", 42, None).expect("png");
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        assert_eq!(
            u32::from_be_bytes(png[16..20].try_into().expect("width")),
            1200
        );
        assert_eq!(
            u32::from_be_bytes(png[20..24].try_into().expect("height")),
            680
        );
        assert!(!png.windows(4).any(|window| window == b"<svg"));
    }

    #[test]
    fn rasterized_card_contains_the_name_and_streak_number() {
        let png = build_streak_card("Micon & Co", 42, None).expect("png");
        let pixmap = decode_card(&png);
        let name_pixels = (450..750)
            .flat_map(|x| (200..250).map(move |y| (x, y)))
            .filter(|(x, y)| {
                let color = pixmap.pixel(*x, *y).expect("name pixel").demultiply();
                color.red() == 0xf7 && color.green() == 0xf9 && color.blue() == 0xfc
            })
            .count();
        let cyan_text_pixels = pixmap
            .pixels()
            .iter()
            .filter(|pixel| {
                let color = pixel.demultiply();
                color.red() == 0x45 && color.green() == 0xd6 && color.blue() == 0xdc
            })
            .count();

        assert!(
            name_pixels > 50,
            "expected the member name to be rasterized, found {name_pixels} pixels"
        );
        assert!(
            cyan_text_pixels > 100,
            "expected the cyan streak number to be rasterized, found {cyan_text_pixels} pixels"
        );
    }

    #[test]
    fn card_avatar_url_requests_a_small_static_asset() {
        assert_eq!(
            card_avatar_url("https://cdn.discordapp.com/avatars/1/hash.webp?size=1024"),
            "https://cdn.discordapp.com/avatars/1/hash.webp?size=256"
        );
    }

    #[test]
    fn invalid_avatar_falls_back_to_the_white_placeholder() {
        let png = build_streak_card("Micon", 42, Some("data:image/png;base64,not-an-image"))
            .expect("placeholder png");
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn valid_avatar_data_url_is_rendered_into_the_card() {
        let mut avatar = resvg::tiny_skia::Pixmap::new(2, 2).expect("avatar");
        avatar.fill(resvg::tiny_skia::Color::from_rgba8(255, 0, 0, 255));
        let avatar = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(avatar.encode_png().expect("avatar png"))
        );
        let png = build_streak_card("Micon", 42, Some(&avatar)).expect("card png");
        let card = decode_card(&png);
        let center = card.pixel(600, 100).expect("avatar center").demultiply();

        assert_eq!((center.red(), center.green(), center.blue()), (255, 0, 0));
    }
}
