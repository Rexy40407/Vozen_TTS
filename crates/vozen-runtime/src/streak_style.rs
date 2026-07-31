//! Presentation helpers for the activity-streak fire marker.
//!
//! Discord's standard fire emoji has one fixed colour. Pairing it with a coloured heart keeps
//! the fire motif while giving long-running streaks a visible progression without requiring
//! server-specific custom emojis.

const FIRE_TIERS: [&str; 6] = [
    "🔥",   // days 0-29: the starting flame
    "🧡🔥", // days 30-59
    "💜🔥", // days 60-89
    "💙🔥", // days 90-119
    "💛🔥", // days 120-149
    "💚🔥", // days 150+: the highest tier
];

const FLAME_COLORS: [&str; 6] = [
    "#ff9f1c", // orange
    "#ff8a3d", // ember orange
    "#9b6cff", // violet
    "#4da3ff", // blue
    "#ffd166", // gold
    "#55cf8d", // green
];

/// Returns the fire marker for a streak of `days`.
///
/// A new tier starts every 30 days. Negative values are treated as zero so presentation code
/// cannot accidentally index before the first tier when rendering an expired or missing streak.
#[must_use]
pub(crate) fn fire_for_streak(days: i64) -> &'static str {
    FIRE_TIERS[streak_tier(days)]
}

/// Returns the visual flame colour for the current streak tier.
#[must_use]
pub(crate) fn flame_color_for_streak(days: i64) -> &'static str {
    FLAME_COLORS[streak_tier(days)]
}

/// Returns the day at which the next colour tier is earned.
#[must_use]
pub(crate) fn next_flame_milestone(days: i64) -> i64 {
    let safe_days = days.max(0);
    safe_days
        .div_euclid(30)
        .saturating_add(1)
        .saturating_mul(30)
}

fn streak_tier(days: i64) -> usize {
    let tier = days.max(0).div_euclid(30) as usize;
    tier.min(FIRE_TIERS.len() - 1)
}

/// Replaces the fixed fire marker in a localized streak message with the tiered marker.
#[must_use]
pub(crate) fn style_streak_message(message: String, days: i64) -> String {
    message.replace('🔥', fire_for_streak(days))
}

#[cfg(test)]
mod tests {
    use super::{
        fire_for_streak, flame_color_for_streak, next_flame_milestone, style_streak_message,
    };

    #[test]
    fn changes_colour_at_each_thirty_day_boundary() {
        assert_eq!(fire_for_streak(0), "🔥");
        assert_eq!(fire_for_streak(29), "🔥");
        assert_eq!(fire_for_streak(30), "🧡🔥");
        assert_eq!(fire_for_streak(59), "🧡🔥");
        assert_eq!(fire_for_streak(60), "💜🔥");
        assert_eq!(fire_for_streak(90), "💙🔥");
        assert_eq!(fire_for_streak(120), "💛🔥");
        assert_eq!(fire_for_streak(150), "💚🔥");
    }

    #[test]
    fn clamps_invalid_and_very_long_streaks() {
        assert_eq!(fire_for_streak(-1), "🔥");
        assert_eq!(fire_for_streak(10_000), "💚🔥");
    }

    #[test]
    fn exposes_the_current_colour_and_next_milestone() {
        assert_eq!(flame_color_for_streak(42), "#ff8a3d");
        assert_eq!(flame_color_for_streak(60), "#9b6cff");
        assert_eq!(next_flame_milestone(42), 60);
        assert_eq!(next_flame_milestone(60), 90);
    }

    #[test]
    fn styles_every_fire_marker_in_a_localized_message() {
        assert_eq!(
            style_streak_message("🔥 streak · 🔥 60 days".to_owned(), 60),
            "💜🔥 streak · 💜🔥 60 days"
        );
    }
}
