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
const OUTER_FLAME_PATH: &str =
    "M0 86C-51 75-61 30-13-10C-18 26 8 34 23 8C30 35 57 48 43 76C36 89 18 96 0 86Z";
const INNER_FLAME_PATH: &str =
    "M0 70C-17 64-25 47-6 27C-4 44 10 47 17 33C22 50 25 60 14 68C10 71 5 72 0 70Z";

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
    let options = usvg::Options {
        fontdb: Arc::clone(card_font_database()),
        ..usvg::Options::default()
    };
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
    let streak_label = streak_days.to_string();
    let streak_font_size = match streak_label.chars().count() {
        0..=3 => 84,
        4..=5 => 70,
        6..=8 => 52,
        _ => 32,
    };
    let current_color = flame_color_for_streak(streak_days);
    let next_milestone = next_flame_milestone(streak_days);
    let next_color = flame_color_for_streak(next_milestone);
    let (next_heading, next_caption) = if next_color == current_color {
        ("MAX COLOR", "HIGHEST TIER".to_owned())
    } else {
        (
            "NEXT COLOR",
            format!(
                r#"AT <tspan fill="{next_color}" font-size="36">{next_milestone}</tspan> DAYS"#
            ),
        )
    };
    let current_flame = flame_svg(current_color);
    let next_flame = flame_svg(next_color);
    let avatar = avatar_data_url
        .map(|url| {
            format!(
                r#"<image href="{}" x="520" y="68" width="160" height="160" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>"#,
                escape_xml(url)
            )
        })
        .unwrap_or_else(|| r##"<circle cx="600" cy="148" r="80" fill="#ffffff"/>"##.to_owned());

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680" role="img" aria-label="{name} {streak_label} day streak">
  <defs>
    <clipPath id="avatarClip"><circle cx="600" cy="148" r="80"/></clipPath>
  </defs>
  <rect width="1200" height="680" fill="#061522"/>
  <rect x="23" y="23" width="1154" height="634" rx="32" fill="none" stroke="#29465a" stroke-width="2"/>
  <circle cx="600" cy="148" r="84" fill="#061522" stroke="#29465a" stroke-width="2"/>
  {avatar}
  <text x="600" y="278" text-anchor="middle" fill="#eef2f6" font-family="DejaVu Sans, sans-serif" font-size="31" font-weight="700" letter-spacing="1.2">{name}</text>
  <line x1="600" y1="345" x2="600" y2="560" stroke="#29465a" stroke-width="2"/>

  <g transform="translate(340 350) scale(0.74)">
    {current_flame}
  </g>
  <text x="340" y="525" text-anchor="middle" fill="#25c5d8" font-family="DejaVu Sans, sans-serif" font-size="{streak_font_size}" font-weight="800">{streak_label}</text>
  <text x="340" y="568" text-anchor="middle" fill="#eef2f6" font-family="DejaVu Sans, sans-serif" font-size="23" font-weight="700" letter-spacing="4">DAY STREAK</text>

  <text x="850" y="354" text-anchor="middle" fill="#eef2f6" font-family="DejaVu Sans, sans-serif" font-size="23" font-weight="700" letter-spacing="3">{next_heading}</text>
  <g transform="translate(850 390) scale(0.74)">
    {next_flame}
  </g>
  <text x="850" y="535" text-anchor="middle" fill="#eef2f6" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="700">{next_caption}</text>
</svg>"##
    )
}

fn flame_svg(color: &str) -> String {
    format!(
        r##"<path d="{OUTER_FLAME_PATH}" fill="{color}"/>
    <path d="{INNER_FLAME_PATH}" fill="#fff3d6" opacity="0.86"/>"##
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

    use super::{
        INNER_FLAME_PATH, OUTER_FLAME_PATH, build_streak_card, build_streak_card_svg,
        card_avatar_url,
    };

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
    fn approved_template_geometry_is_fixed() {
        let svg = build_streak_card_svg(
            "rexy0345",
            3,
            Some("data:image/png;base64,avatar-placeholder"),
        );

        assert!(svg.contains(r##"<rect width="1200" height="680" fill="#061522"/>"##));
        assert!(svg.contains(
            r##"<rect x="23" y="23" width="1154" height="634" rx="32" fill="none" stroke="#29465a" stroke-width="2"/>"##
        ));
        assert!(svg.contains(r#"<circle cx="600" cy="148" r="84""#));
        assert!(svg.contains(
            r#"<clipPath id="avatarClip"><circle cx="600" cy="148" r="80"/></clipPath>"#
        ));
        assert!(svg.contains(
            r#"x="520" y="68" width="160" height="160" preserveAspectRatio="xMidYMid slice""#
        ));
        assert!(svg.contains(r#"<text x="600" y="278""#));
        assert!(svg.contains(
            r##"<line x1="600" y1="345" x2="600" y2="560" stroke="#29465a" stroke-width="2"/>"##
        ));
        assert!(svg.contains(r#"transform="translate(340 350) scale(0.74)""#));
        assert!(svg.contains(r#"transform="translate(850 390) scale(0.74)""#));
        assert!(svg.contains(r#"<text x="340" y="525""#));
        assert!(svg.contains(r#"<text x="340" y="568""#));
        assert!(svg.contains(r#"<text x="850" y="354""#));
        assert!(svg.contains(r#"<text x="850" y="535""#));
    }

    #[test]
    fn both_flames_reuse_the_exact_same_shape_without_deformation() {
        let svg = build_streak_card_svg("rexy0345", 3, None);

        assert_eq!(svg.matches(OUTER_FLAME_PATH).count(), 2);
        assert_eq!(svg.matches(INNER_FLAME_PATH).count(), 2);
        assert_eq!(svg.matches("scale(0.74)").count(), 2);
    }

    #[test]
    fn terminal_tier_does_not_promise_a_nonexistent_next_color() {
        let before_terminal = build_streak_card_svg("Micon", 149, None);
        assert!(before_terminal.contains("NEXT COLOR"));
        assert!(before_terminal.contains(">150</tspan> DAYS"));

        let terminal = build_streak_card_svg("Micon", 150, None);
        assert!(terminal.contains("MAX COLOR"));
        assert!(terminal.contains("HIGHEST TIER"));
        assert!(!terminal.contains("NEXT COLOR"));
        assert!(!terminal.contains("AT <tspan"));
    }

    #[test]
    fn extreme_streak_values_shrink_to_stay_inside_the_left_column() {
        assert!(build_streak_card_svg("Micon", 1_000, None).contains(r#"font-size="70""#));
        assert!(build_streak_card_svg("Micon", 100_000, None).contains(r#"font-size="52""#));
        let svg = build_streak_card_svg("Micon", i64::MAX, None);
        assert!(svg.contains(r#"font-size="32" font-weight="800">9223372036854775807</text>"#));
        let png = build_streak_card("Micon", i64::MAX, None).expect("extreme streak png");
        let card = decode_card(&png);
        let number_x = (0..1200)
            .filter(|x| {
                (485..530).any(|y| {
                    let color = card.pixel(*x, y).expect("number pixel").demultiply();
                    color.red() == 0x25 && color.green() == 0xc5 && color.blue() == 0xd8
                })
            })
            .collect::<Vec<_>>();

        assert!(!number_x.is_empty());
        assert!(number_x[0] > 23, "streak number touched the left border");
        assert!(
            number_x[number_x.len() - 1] < 600,
            "streak number crossed the divider"
        );
    }

    #[test]
    fn wide_display_names_remain_inside_the_card_border() {
        let png = build_streak_card("WWWWWWWWWWWWWWWWWWWWWWWW", 42, None).expect("png");
        let pixmap = decode_card(&png);
        let name_x = (0..1200)
            .filter(|x| {
                (245..290).any(|y| {
                    let color = pixmap.pixel(*x, y).expect("name pixel").demultiply();
                    color.red() == 0xee && color.green() == 0xf2 && color.blue() == 0xf6
                })
            })
            .collect::<Vec<_>>();

        assert!(!name_x.is_empty());
        assert!(name_x[0] > 23, "name touched the left border");
        assert!(
            name_x[name_x.len() - 1] < 1177,
            "name touched the right border"
        );
    }

    #[test]
    fn placeholder_uses_the_approved_center_and_radius() {
        let png = build_streak_card("Micon", 42, None).expect("png");
        let card = decode_card(&png);
        let center = card.pixel(600, 148).expect("center").demultiply();
        let inside_edge = card.pixel(679, 148).expect("inside edge").demultiply();
        let outside_edge = card.pixel(682, 148).expect("outside edge").demultiply();

        assert_eq!(
            (center.red(), center.green(), center.blue()),
            (255, 255, 255)
        );
        assert_eq!(
            (inside_edge.red(), inside_edge.green(), inside_edge.blue()),
            (255, 255, 255)
        );
        assert_ne!(
            (
                outside_edge.red(),
                outside_edge.green(),
                outside_edge.blue()
            ),
            (255, 255, 255)
        );
    }

    #[test]
    fn rasterized_card_contains_the_name_and_streak_number() {
        let png = build_streak_card("Micon & Co", 42, None).expect("png");
        let pixmap = decode_card(&png);
        let name_pixels = (450..750)
            .flat_map(|x| (245..290).map(move |y| (x, y)))
            .filter(|(x, y)| {
                let color = pixmap.pixel(*x, *y).expect("name pixel").demultiply();
                color.red() == 0xee && color.green() == 0xf2 && color.blue() == 0xf6
            })
            .count();
        let cyan_text_pixels = pixmap
            .pixels()
            .iter()
            .filter(|pixel| {
                let color = pixel.demultiply();
                color.red() == 0x25 && color.green() == 0xc5 && color.blue() == 0xd8
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
        let mut avatar = resvg::tiny_skia::Pixmap::new(4, 2).expect("avatar");
        let columns = [
            [255, 0, 0, 255],
            [0, 255, 0, 255],
            [0, 0, 255, 255],
            [255, 255, 0, 255],
        ];
        for row in 0..2 {
            for (column, rgba) in columns.iter().enumerate() {
                let offset = (row * 4 + column) * 4;
                avatar.data_mut()[offset..offset + 4].copy_from_slice(rgba);
            }
        }
        let avatar = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(avatar.encode_png().expect("avatar png"))
        );
        let png = build_streak_card("Micon", 42, Some(&avatar)).expect("card png");
        let card = decode_card(&png);
        let left = card.pixel(550, 148).expect("avatar left").demultiply();
        let right = card.pixel(650, 148).expect("avatar right").demultiply();
        let clipped_corner = card.pixel(525, 73).expect("clipped corner").demultiply();

        assert!(left.green() > left.red() && left.green() > left.blue());
        assert!(right.blue() > right.red() && right.blue() > right.green());
        assert_eq!(
            (
                clipped_corner.red(),
                clipped_corner.green(),
                clipped_corner.blue()
            ),
            (0x06, 0x15, 0x22)
        );
    }
}
