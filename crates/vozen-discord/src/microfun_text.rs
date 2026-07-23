//! Deterministic content banks for the public micro-fun commands.
//!
//! The Node implementation intentionally keeps these commands short and SFW so they can be
//! displayed in Discord and spoken by the selected voice without provider-specific surprises.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MicroFunKind {
    EightBall,
    Fortune,
    Fact,
    WouldYouRather,
}

impl MicroFunKind {
    pub const fn response_key(self) -> &'static str {
        match self {
            Self::EightBall => "fun.eightball",
            Self::Fortune => "fun.fortune",
            Self::Fact => "fun.fact",
            Self::WouldYouRather => "fun.wyr",
        }
    }
}

const EIGHTBALL_EN: &[&str] = &[
    "It is certain.",
    "Without a doubt.",
    "Yes, definitely.",
    "You may rely on it.",
    "Most likely.",
    "Outlook good.",
    "Signs point to yes.",
    "Reply hazy, try again.",
    "Ask again later.",
    "Cannot predict now.",
    "Don't count on it.",
    "My reply is no.",
    "Very doubtful.",
    "Absolutely not.",
];
const EIGHTBALL_PT: &[&str] = &[
    "É certo.",
    "Sem dúvida.",
    "Sim, definitivamente.",
    "Podes contar com isso.",
    "Muito provável.",
    "As perspetivas são boas.",
    "Os sinais apontam que sim.",
    "Resposta nebulosa, tenta outra vez.",
    "Pergunta outra vez mais tarde.",
    "Não consigo prever agora.",
    "Não contes com isso.",
    "A minha resposta é não.",
    "Muito duvidoso.",
    "Nem pensar.",
];

const FORTUNE_EN: &[&str] = &[
    "A pleasant surprise is waiting for you.",
    "Your hard work is about to pay off.",
    "A new friend will brighten your week.",
    "Adventure is on the horizon — say yes.",
    "Good news will come from far away.",
    "Trust your gut today; it is right.",
    "Something you lost will find its way back.",
    "A small act of kindness comes back tenfold.",
    "The next opportunity is worth the risk.",
    "Laughter will find you when you least expect it.",
];
const FORTUNE_PT: &[&str] = &[
    "Uma surpresa agradável está à tua espera.",
    "O teu esforço está prestes a dar frutos.",
    "Um novo amigo vai alegrar a tua semana.",
    "A aventura está no horizonte — diz que sim.",
    "Boas notícias virão de longe.",
    "Confia no teu instinto hoje; ele tem razão.",
    "Algo que perdeste vai voltar a ti.",
    "Um pequeno gesto de bondade volta multiplicado.",
    "A próxima oportunidade vale o risco.",
    "O riso vai encontrar-te quando menos esperares.",
];

const FACT_EN: &[&str] = &[
    "Octopuses have three hearts.",
    "Honey never spoils.",
    "Bananas are berries, but strawberries are not.",
    "A group of flamingos is called a flamboyance.",
    "Sharks existed before trees did.",
    "A day on Venus is longer than its year.",
    "Sea otters hold hands while they sleep.",
    "Bubble wrap was originally invented as wallpaper.",
    "The Eiffel Tower can grow over fifteen centimeters in summer.",
    "A shrimp has its heart in its head.",
];
const FACT_PT: &[&str] = &[
    "Os polvos têm três corações.",
    "O mel nunca se estraga.",
    "As bananas são bagas, mas os morangos não.",
    "Um grupo de flamingos chama-se um flamboyance.",
    "Os tubarões existiam antes das árvores.",
    "Um dia em Vénus é mais longo do que o seu ano.",
    "As lontras-marinhas dormem de mãos dadas.",
    "O plástico-bolha foi inventado como papel de parede.",
    "A Torre Eiffel pode crescer mais de quinze centímetros no verão.",
    "O camarão tem o coração na cabeça.",
];

const WYR_EN: &[&str] = &[
    "Would you rather be able to fly or be invisible?",
    "Would you rather have unlimited pizza or unlimited tacos for life?",
    "Would you rather never have to sleep or never have to eat?",
    "Would you rather live without music or without movies?",
    "Would you rather be a wizard or a superhero?",
    "Would you rather always be ten minutes late or always twenty minutes early?",
    "Would you rather speak every language or play every instrument?",
    "Would you rather explore outer space or the deep ocean?",
];
const WYR_PT: &[&str] = &[
    "Preferias poder voar ou ser invisível?",
    "Preferias ter pizza infinita ou tacos infinitos para o resto da vida?",
    "Preferias nunca ter de dormir ou nunca ter de comer?",
    "Preferias viver sem música ou sem filmes?",
    "Preferias ser um feiticeiro ou um super-herói?",
    "Preferias chegar sempre dez minutos atrasado ou sempre vinte minutos adiantado?",
    "Preferias falar todas as línguas ou tocar todos os instrumentos?",
    "Preferias explorar o espaço ou o fundo do oceano?",
];

fn bank(kind: MicroFunKind, portuguese: bool) -> &'static [&'static str] {
    match (kind, portuguese) {
        (MicroFunKind::EightBall, false) => EIGHTBALL_EN,
        (MicroFunKind::EightBall, true) => EIGHTBALL_PT,
        (MicroFunKind::Fortune, false) => FORTUNE_EN,
        (MicroFunKind::Fortune, true) => FORTUNE_PT,
        (MicroFunKind::Fact, false) => FACT_EN,
        (MicroFunKind::Fact, true) => FACT_PT,
        (MicroFunKind::WouldYouRather, false) => WYR_EN,
        (MicroFunKind::WouldYouRather, true) => WYR_PT,
    }
}

pub fn pick_microfun(kind: MicroFunKind, locale: &str, seed: i64) -> String {
    let list = bank(
        kind,
        locale
            .get(..2)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("pt")),
    );
    let index = seed.rem_euclid(list.len() as i64) as usize;
    list[index].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_node_banks_and_locale_fallback() {
        assert_eq!(
            pick_microfun(MicroFunKind::EightBall, "en", 0),
            "It is certain."
        );
        assert_eq!(
            pick_microfun(MicroFunKind::EightBall, "pt-PT", 0),
            "É certo."
        );
        assert_eq!(
            pick_microfun(MicroFunKind::Fact, "fr", 0),
            "Octopuses have three hearts."
        );
        assert_eq!(
            pick_microfun(MicroFunKind::WouldYouRather, "pt", -1),
            "Preferias explorar o espaço ou o fundo do oceano?"
        );
    }
}
