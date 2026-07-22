//! Conservative per-language accent restoration before speech synthesis.
//!
//! Each dictionary intentionally excludes ambiguous forms (for example Portuguese `esta`/
//! `está`).  A missing accent is preferable to changing the meaning of a real word.

use crate::speech_safety::replace_whole_word_with;

type Dictionary = &'static [(&'static str, &'static str)];

const PORTUGUESE: Dictionary = &[
    ("nao", "não"),
    ("sao", "são"),
    ("entao", "então"),
    ("estao", "estão"),
    ("voce", "você"),
    ("voces", "vocês"),
    ("portugues", "português"),
    ("ingles", "inglês"),
    ("frances", "francês"),
    ("japones", "japonês"),
    ("chines", "chinês"),
    ("alemao", "alemão"),
    ("tambem", "também"),
    ("alem", "além"),
    ("ninguem", "ninguém"),
    ("alguem", "alguém"),
    ("parabens", "parabéns"),
    ("porem", "porém"),
    ("amanha", "amanhã"),
    ("manhas", "manhãs"),
    ("rapido", "rápido"),
    ("rapida", "rápida"),
    ("rapidos", "rápidos"),
    ("rapidas", "rápidas"),
    ("facil", "fácil"),
    ("faceis", "fáceis"),
    ("dificil", "difícil"),
    ("dificeis", "difíceis"),
    ("ultimo", "último"),
    ("ultima", "última"),
    ("ultimos", "últimos"),
    ("ultimas", "últimas"),
    ("proximo", "próximo"),
    ("proxima", "próxima"),
    ("proximos", "próximos"),
    ("proximas", "próximas"),
    ("numero", "número"),
    ("numeros", "números"),
    ("pagina", "página"),
    ("paginas", "páginas"),
    ("familia", "família"),
    ("familias", "famílias"),
    ("policia", "polícia"),
    ("experiencia", "experiência"),
    ("paciencia", "paciência"),
    ("ciencia", "ciência"),
    ("historia", "história"),
    ("historias", "histórias"),
    ("memoria", "memória"),
    ("vitoria", "vitória"),
    ("gloria", "glória"),
    ("servico", "serviço"),
    ("servicos", "serviços"),
    ("preco", "preço"),
    ("precos", "preços"),
    ("comecar", "começar"),
    ("comeca", "começa"),
    ("comecou", "começou"),
    ("coracao", "coração"),
    ("coracoes", "corações"),
    ("mae", "mãe"),
    ("maes", "mães"),
    ("irmao", "irmão"),
    ("irmaos", "irmãos"),
    ("irma", "irmã"),
    ("agua", "água"),
    ("aguas", "águas"),
    ("otimo", "ótimo"),
    ("otima", "ótima"),
    ("pessimo", "péssimo"),
    ("pessima", "péssima"),
    ("unico", "único"),
    ("unica", "única"),
    ("possivel", "possível"),
    ("impossivel", "impossível"),
    ("possiveis", "possíveis"),
    ("nivel", "nível"),
    ("niveis", "níveis"),
    ("util", "útil"),
    ("inutil", "inútil"),
    ("maquina", "máquina"),
    ("maquinas", "máquinas"),
    ("video", "vídeo"),
    ("videos", "vídeos"),
    ("musculo", "músculo"),
    ("ate", "até"),
];

const SPANISH: Dictionary = &[
    ("informacion", "información"),
    ("corazon", "corazón"),
    ("tambien", "también"),
    ("adios", "adiós"),
    ("facil", "fácil"),
    ("dificil", "difícil"),
    ("rapido", "rápido"),
    ("ultimo", "último"),
    ("numero", "número"),
    ("pagina", "página"),
    ("telefono", "teléfono"),
    ("arbol", "árbol"),
    ("lapiz", "lápiz"),
    ("musica", "música"),
    ("pelicula", "película"),
    ("cancion", "canción"),
    ("espanol", "español"),
    ("ingles", "inglés"),
    ("frances", "francés"),
    ("aqui", "aquí"),
    ("alli", "allí"),
    ("ademas", "además"),
    ("despues", "después"),
    ("quiza", "quizá"),
];

const FRENCH: Dictionary = &[
    ("francais", "français"),
    ("tres", "très"),
    ("etre", "être"),
    ("deja", "déjà"),
    ("apres", "après"),
    ("cafe", "café"),
    ("ecole", "école"),
    ("etudiant", "étudiant"),
    ("numero", "numéro"),
    ("telephone", "téléphone"),
    ("tele", "télé"),
    ("fenetre", "fenêtre"),
    ("theatre", "théâtre"),
    ("probleme", "problème"),
    ("systeme", "système"),
    ("modele", "modèle"),
    ("celebre", "célèbre"),
    ("repondre", "répondre"),
    ("prefere", "préfère"),
    ("achete", "achète"),
];

const GERMAN: Dictionary = &[
    ("fur", "für"),
    ("konnen", "können"),
    ("mussen", "müssen"),
    ("durfen", "dürfen"),
    ("naturlich", "natürlich"),
    ("moglich", "möglich"),
    ("wahrend", "während"),
    ("grun", "grün"),
    ("tur", "tür"),
    ("kuche", "küche"),
    ("madchen", "mädchen"),
    ("horen", "hören"),
    ("gehoren", "gehören"),
    ("wunschen", "wünschen"),
    ("fuhlen", "fühlen"),
    ("erzahlen", "erzählen"),
    ("funf", "fünf"),
    ("glucklich", "glücklich"),
    ("zuruck", "zurück"),
];

/// Restores only safe, curated accents for the provided ISO 639-3 language.
pub fn restore_accents(text: &str, language: &str) -> String {
    let dictionary = match language {
        "por" => PORTUGUESE,
        "spa" => SPANISH,
        "fra" => FRENCH,
        "deu" => GERMAN,
        _ => return text.to_owned(),
    };
    dictionary
        .iter()
        .fold(text.to_owned(), |current, (plain, accented)| {
            replace_whole_word_with(&current, plain, |matched| match_case(matched, accented)).0
        })
}

fn match_case(sample: &str, accented: &str) -> String {
    let has_cased_letter = sample
        .chars()
        .any(|character| character.is_uppercase() || character.is_lowercase());
    if has_cased_letter && sample == sample.to_uppercase() {
        return accented.to_uppercase();
    }
    let Some(first) = sample.chars().next() else {
        return accented.to_owned();
    };
    if first.is_uppercase() {
        let mut accented_chars = accented.chars();
        let Some(accented_first) = accented_chars.next() else {
            return accented.to_owned();
        };
        return format!(
            "{}{}",
            accented_first.to_uppercase(),
            &accented[accented_first.len_utf8()..]
        );
    }
    accented.to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_each_supported_language_without_cross_language_changes() {
        assert_eq!(restore_accents("Nao VOCE amanha", "por"), "Não VOCÊ amanhã");
        assert_eq!(
            restore_accents("informacion rapido", "spa"),
            "información rápido"
        );
        assert_eq!(restore_accents("Francais tres", "fra"), "Français très");
        assert_eq!(
            restore_accents("KONNEN naturlich", "deu"),
            "KÖNNEN natürlich"
        );
        assert_eq!(restore_accents("nao informacion", "eng"), "nao informacion");
    }

    #[test]
    fn preserves_word_boundaries_and_ambiguous_forms() {
        assert_eq!(restore_accents("naox esta sao", "por"), "naox esta são");
        assert_eq!(restore_accents("musica", "por"), "musica");
    }
}
