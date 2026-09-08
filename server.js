const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;


// =====================================================
// PÁGINA INICIAL
// =====================================================

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/taxon/:nome", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});


// =====================================================
// API TAXONÔMICA
// CHECKLISTBANK + WORMS + ESCHMEYER
// =====================================================

app.get("/api/taxon", async (req, res) => {

    const nome = req.query.q;

    if (!nome) {

        return res.status(400).json({
            erro: "Informe um nome científico."
        });

    }

    // =================================================
    // VARIÁVEIS
    // =================================================

    let checklistbank = null;
    let worms = null;
    let eschmeyer = null;
    let inaturalist = null;
    let ncbi = null;
    let wikipedia = null;
    let wikispecies = null;
    let academico = null;

// =====================================================
// WIKIPEDIA
// =====================================================

try {

    const urlWikipedia =
        `https://pt.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&exintro=true&explaintext=true&inprop=url&redirects=true&titles=${encodeURIComponent(nome)}&origin=*`;

    const respostaWikipedia =
        await fetch(urlWikipedia);

    const dadosWikipedia =
        await respostaWikipedia.json();

    const paginas =
        dadosWikipedia.query?.pages || {};

    const pagina =
        Object.values(paginas)[0];

    if (
        pagina &&
        pagina.pageid &&
        pagina.extract
    ) {

        wikipedia = {

            encontrado: true,

            titulo:
                pagina.title || null,

            descricao:
                pagina.extract || null,

            url:
                pagina.fullurl || null

        };

    } else {

        wikipedia = {

            encontrado: false

        };

    }

} catch (erroWikipedia) {

    console.error(
        "Erro ao consultar Wikipedia:",
        erroWikipedia
    );

    wikipedia = {

        encontrado: false,

        erro:
            "Não foi possível consultar a Wikipedia."

    };

}

// =====================================================
// WIKISPECIES
// =====================================================

try {

    const urlWikispecies =
        `https://species.wikimedia.org/w/api.php?action=query&format=json&prop=extracts|info&exintro=true&explaintext=true&inprop=url&redirects=true&titles=${encodeURIComponent(nome)}&origin=*`;

    const respostaWikispecies =
        await fetch(urlWikispecies);

    const dadosWikispecies =
        await respostaWikispecies.json();

    const paginas =
        dadosWikispecies.query?.pages || {};

    const pagina =
        Object.values(paginas)[0];

if (
    pagina &&
    pagina.pageid
) {

        wikispecies = {

            encontrado: true,

            titulo:
                pagina.title || null,

            descricao:
                pagina.extract || null,

            url:
                pagina.fullurl || null

        };

    } else {

        wikispecies = {

            encontrado: false

        };

    }

} catch (erroWikispecies) {

    console.error(
        "Erro ao consultar Wikispecies:",
        erroWikispecies
    );

    wikispecies = {

        encontrado: false,

        erro:
            "Não foi possível consultar a Wikispecies."

    };

}

// =====================================================
// RESULTADOS ACADÊMICOS - OPENALEX
// =====================================================

try {

    const urlAcademico =
    `https://api.openalex.org/works?search=${encodeURIComponent(nome)}&per-page=5&sort=relevance_score:desc`;

    const respostaAcademico =
        await fetch(urlAcademico);

    const dadosAcademico =
        await respostaAcademico.json();

    const resultadosAcademicos =
        dadosAcademico.results || [];

    if (resultadosAcademicos.length > 0) {

        academico = {

            encontrado: true,

            resultados:
                resultadosAcademicos.map(artigo => ({

                    titulo:
                        artigo.title || null,

                    autores:
                        artigo.authorships
                            ?.map(autor =>
                                autor.author?.display_name
                            )
                            .filter(Boolean) || [],

                    ano:
                        artigo.publication_year || null,

		descricao:
    		artigo.abstract_inverted_index
        		? Object.entries(artigo.abstract_inverted_index)
            		.sort((a, b) => a[1][0] - b[1][0])
            		.map(item => item[0])
            		.join(" ")
        		: null,

                    doi:
                        artigo.doi || null,

                    url:
                        artigo.primary_location?.landing_page_url
                        || artigo.primary_location?.pdf_url
                        || null

                }))

        };

    } else {

        academico = {

            encontrado: false,

            resultados: []

        };

    }

} catch (erroAcademico) {

    console.error(
        "Erro ao consultar OpenAlex:",
        erroAcademico
    );

    academico = {

        encontrado: false,

        resultados: [],

        erro:
            "Não foi possível consultar os resultados acadêmicos."

    };

}

    // =================================================
// CHECKLISTBANK
// =================================================

try {

    const urlChecklistBank =
        `https://api.checklistbank.org/dataset/3LR/nameusage/search?q=${encodeURIComponent(nome)}&limit=20`;

    const respostaChecklistBank =
        await fetch(urlChecklistBank);

    const dadosChecklistBank =
        await respostaChecklistBank.json();

    const resultados =
        Array.isArray(dadosChecklistBank.result)
            ? dadosChecklistBank.result
            : [];

    // -----------------------------------------
    // FILTRA SOMENTE O NOME CIENTÍFICO EXATO
    // -----------------------------------------

    const usos =
        resultados.filter(item =>
            item.usage?.name?.scientificName?.toLowerCase() ===
            nome.toLowerCase()
        );

    if (usos.length > 0) {

        const processarUso = (item) => {

            const uso =
                item.usage;

            let nomeAceito = null;

            // -----------------------------------------
            // SINÔNIMO
            // -----------------------------------------

            if (uso.status === "synonym") {

const registroAceito =
    item.classification?.find(
        registro =>
            registro.status === "accepted" &&
            registro.rank === uso.name?.rank
    );
                if (registroAceito) {

                    nomeAceito =
                        registroAceito.name;

                }

            }

            // -----------------------------------------
            // CLASSIFICAÇÃO
            // -----------------------------------------

            const classificacao = {};

            if (Array.isArray(item.classification)) {

                item.classification.forEach(registro => {

                    if (registro.rank === "kingdom") {
                        classificacao.reino = registro.name;
                    }

                    if (registro.rank === "phylum") {
                        classificacao.filo = registro.name;
                    }

                    if (registro.rank === "class") {
                        classificacao.classe = registro.name;
                    }

                    if (registro.rank === "order") {
                        classificacao.ordem = registro.name;
                    }

                    if (registro.rank === "family") {
                        classificacao.familia = registro.name;
                    }

                    if (registro.rank === "genus") {
                        classificacao.genero = registro.name;
                    }

                });

            }

            // -----------------------------------------
            // O PRÓPRIO TÁXON
            // -----------------------------------------

            if (uso.rank === "kingdom") {
                classificacao.reino = uso.name.scientificName;
            }

            if (uso.rank === "phylum") {
                classificacao.filo = uso.name.scientificName;
            }

            if (uso.rank === "class") {
                classificacao.classe = uso.name.scientificName;
            }

            if (uso.rank === "order") {
                classificacao.ordem = uso.name.scientificName;
            }

            if (uso.rank === "family") {
                classificacao.familia = uso.name.scientificName;
            }

            if (uso.rank === "genus") {
                classificacao.genero = uso.name.scientificName;
            }

            return {

                id:
                    uso.id || null,

                nome:
                    uso.name?.scientificName || null,

                autoria:
                    uso.name?.authorship || null,

                rank:
                    uso.name?.rank || null,

                status:
                    uso.status || null,

                nomeAceito:
                    nomeAceito,

                reino:
                    classificacao.reino || null,

                filo:
                    classificacao.filo || null,

                classe:
                    classificacao.classe || null,

                ordem:
                    classificacao.ordem || null,

                familia:
                    classificacao.familia || null,

                genero:
                    classificacao.genero || null

            };

        };

        // -----------------------------------------
        // PROCESSA OS RESULTADOS
        // -----------------------------------------

        const registros =
            usos.map(processarUso);

        // -----------------------------------------
        // RESULTADO ÚNICO OU HOMÔNIMOS
        // -----------------------------------------

        if (registros.length === 1) {

            checklistbank = {

                encontrado: true,

                ...registros[0]

            };

        } else {

            checklistbank = {

                encontrado: true,

                homonimos: true,

                resultados:
                    registros

            };

        }

    } else {

        checklistbank = {

            encontrado: false

        };

    }

} catch (erroChecklistBank) {

    console.error(
        "Erro ao consultar ChecklistBank:",
        erroChecklistBank
    );

    checklistbank = {

        encontrado: false,

        erro:
            "Não foi possível consultar o ChecklistBank."

    };

}

// =====================================================
// WORMS
// =====================================================

try {

    const urlWorms =
        `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(nome)}`;

    const respostaWorms =
        await fetch(urlWorms);

    const dadosWorms =
        await respostaWorms.json();

    const registrosWorms =
        Array.isArray(dadosWorms)
            ? dadosWorms
            : [];

    // Mantém somente nomes científicos exatamente iguais
    // ao nome pesquisado
    const registrosExatos =
        registrosWorms.filter(registro =>
            registro.scientificname?.toLowerCase() ===
            nome.toLowerCase()
        );

    const processarWorms =
        (registro) => {

            const aphiaID =
                registro.AphiaID;

            const nomeWorms =
                registro.scientificname || null;

            const autoridade =
                registro.authority || null;

            const rank =
                registro.rank || null;

            const status =
                registro.status || null;

            const nomeValido =
                registro.valid_name || null;

            const aphiaIDValido =
                registro.valid_AphiaID || null;

            const autoridadeNomeValido =
                registro.valid_authority || null;

            return {

                aphiaID:
                    aphiaID,

                nome:
                    nomeWorms,

                autoria:
                    autoridade,

                rank:
                    rank,

                status:
                    status,

		tipo:
    		status === "unaccepted"
        		? "sinonimo"
        		: "valido",

                nomeAceito:
                    nomeValido,

                aphiaIDAceito:
                    aphiaIDValido,

                autoriaNomeAceito:
                    autoridadeNomeValido,

                reino:
                    registro.kingdom || null,

                filo:
                    registro.phylum || null,

                classe:
                    registro.class || null,

                ordem:
                    registro.order || null,

                familia:
                    registro.family || null,

                genero:
                    registro.genus || null,

                marinho:
                    registro.isMarine === 1,

                salobra:
                    registro.isBrackish === 1,

                aguaDoce:
                    registro.isFreshwater === 1,

                terrestre:
                    registro.isTerrestrial === 1,

                extinto:
                    registro.isExtinct === 1
            };
        };

    if (registrosExatos.length === 1) {

        worms = {

            encontrado: true,

            ...processarWorms(
                registrosExatos[0]
            )
        };

    } else if (registrosExatos.length > 1) {

        worms = {

            encontrado: true,

            homonimos: true,

            resultados:
                registrosExatos.map(
                    processarWorms
                )
        };

    } else {

        worms = {

            encontrado: false
        };
    }

} catch (erroWorms) {

    console.error(
        "Erro ao consultar WoRMS:",
        erroWorms
    );

    worms = {

        encontrado: false,

        erro:
            "Não foi possível consultar o WoRMS."
    };
}

  // =====================================================
// ESCHMEYER
// =====================================================

try {

    const partes =
        nome.trim().split(/\s+/);

// =================================================
// FAMÍLIA
// =================================================

if (
    partes.length === 1 &&
    nome.toLowerCase().endsWith("idae")
) {

    const familia =
        nome.trim();


    const urlEschmeyerFamilias =
        "https://researcharchive.calacademy.org/research/ichthyology/catalog/SpeciesByFamily.asp";


    const respostaEschmeyer =
        await fetch(urlEschmeyerFamilias);


    const html =
        await respostaEschmeyer.text();


    // -------------------------------------------------
    // Divide a página em linhas da tabela
    // -------------------------------------------------

    const linhas =
        html.match(/<tr[\s\S]*?<\/tr>/gi);


    let ordemEncontrada = null;

    let familiaEncontrada = null;


    if (linhas) {

        for (const linha of linhas) {

            const textoLinha =
                linha
                    .replace(/<[^>]*>/g, " ")
                    .replace(/&nbsp;/g, " ")
                    .replace(/&amp;/g, "&")
                    .replace(/\s+/g, " ")
                    .trim();


            // -----------------------------------------
            // Procura a família
            // -----------------------------------------

            const regexFamilia =
                new RegExp(
                    `\\b${familia}\\b`,
                    "i"
                );


          if (regexFamilia.test(textoLinha)) {

    familiaEncontrada =
        familia;

// -------------------------------------
// Procura a ordem nas linhas anteriores
// -------------------------------------

const indiceFamilia =
    linhas.indexOf(linha);


for (
    let i = indiceFamilia - 1;
    i >= 0 && i >= indiceFamilia - 10;
    i--
) {

    const textoLinhaAnterior =
        linhas[i]
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim();


    const ordemMatch =
        textoLinhaAnterior.match(
            /\b([A-Z][A-Za-z-]+iformes)\b/
        );


    if (ordemMatch) {

        ordemEncontrada =
            ordemMatch[1];

        break;

    }

}
   
    break;

}

        }

    }


    // -------------------------------------------------
    // Resultado
    // -------------------------------------------------

    if (familiaEncontrada) {

        eschmeyer = {

            encontrado: true,

            tipo: "familia",

            nome:
                familiaEncontrada,

            familia:
                familiaEncontrada,

            ordem:
                ordemEncontrada

        };


    } else {

        eschmeyer = {

            encontrado: false,

            tipo: "familia",

            nome:
                familia,

            motivo:
                "Família não encontrada na classificação do Eschmeyer."

        };

    }       

// =================================================
    // ESPÉCIE
    // =================================================

    } else if (partes.length >= 2) {

        const genero =
            partes[0];

        const especie =
            partes[1];


        const urlEschmeyer =
            `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=species&genus=${encodeURIComponent(genero)}&species=${encodeURIComponent(especie)}`;


        const respostaEschmeyer =
            await fetch(urlEschmeyer);


        const html =
            await respostaEschmeyer.text();


        const registros =
            html.match(
                /<p class="result"[\s\S]*?<\/p>/g
            );


        if (registros) {

            const resultados = [];


            registros.forEach(registro => {

                const idMatch =
                    registro.match(
                        /spid="(\d+)"/
                    );


                const id =
                    idMatch
                        ? idMatch[1]
                        : null;


                const texto =
                    registro
                        .replace(/<[^>]*>/g, " ")
                        .replace(/&bull;/g, "•")
                        .replace(/&amp;/g, "&")
                        .replace(/&#233;/g, "é")
                        .replace(/&#234;/g, "ê")
                        .replace(/&#225;/g, "á")
                        .replace(/&#243;/g, "ó")
                        .replace(/&#231;/g, "ç")
                        .replace(/&#269;/g, "č")
                        .replace(/&#263;/g, "ć")
                        .replace(/&#268;/g, "Č")
                        .replace(/&#252;/g, "ü")
                        .replace(/&#241;/g, "ñ")
                        .replace(/&#355;/g, "ţ")
                        .replace(/\s+/g, " ")
                        .trim();


                const statusMatch =
                    texto.match(
                        /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z]+idae(?::\s+[A-Z][A-Za-z]+)?\.)/
                    );


                const status =
                    statusMatch
                        ? statusMatch[1].trim()
                        : null;


                const familiaMatch =
                    texto.match(
                        /Current status:.*?\.\s+([A-Z][A-Za-z]+idae)(?::\s+[A-Z][A-Za-z]+)?\./
                    );


                const familia =
                    familiaMatch
                        ? familiaMatch[1]
                        : null;


                const habitatMatch =
                    texto.match(
                        /Habitat:\s*(.*?)(?:\.|$)/
                    );


                const habitat =
                    habitatMatch
                        ? habitatMatch[1]
                        : null;


                let nomeAceito = null;


                if (
                    status &&
                    status.startsWith("Synonym of ")
                ) {

                    nomeAceito =
                        status
                            .replace(
                                "Synonym of ",
                                ""
                            )
                            .trim();

                }


                resultados.push({

                    id:
                        id,

                    nome:
                        nome,

                    status:
                        status,

                    nomeAceito:
                        nomeAceito,

                    familia:
                        familia,

                    habitat:
                        habitat

                });

            });


            const registroValido =
                resultados.find(
                    registro =>
                        registro.status &&
                        registro.status.startsWith(
                            "Valid as "
                        )
                );

if (registroValido) {

    const nomeDepoisValidAs =
        registroValido.status
            .replace("Valid as ", "")
            .trim();

    const ehSinonimo =
        nomeDepoisValidAs.toLowerCase() !==
        nome.toLowerCase();

    eschmeyer = {

        encontrado: true,

        tipo:
            ehSinonimo
                ? "sinonimo"
                : "valido",

        id:
            registroValido.id,

        nome:
            registroValido.nome,

        status:
            registroValido.status,

        nomeAceito:
            ehSinonimo
                ? nomeDepoisValidAs
                : null,

        familia:
            registroValido.familia,

        habitat:
            registroValido.habitat

    };


            } else {


                const registroSinonimo =
                    resultados.find(
                        registro =>
                            registro.status &&
                            registro.status.startsWith(
                                "Synonym of "
                            )
                    );


                if (registroSinonimo) {

                    eschmeyer = {

                        encontrado: true,

                        tipo: "sinonimo",

                        id:
                            registroSinonimo.id,

                        nome:
                            registroSinonimo.nome,

                        status:
                            registroSinonimo.status,

                        nomeAceito:
                            registroSinonimo.nomeAceito,

                        familia:
                            registroSinonimo.familia,

                        habitat:
                            registroSinonimo.habitat

                    };


                } else {

                    eschmeyer = {

                        encontrado: true,

                        tipo: "incerto",

                        resultados:
                            resultados

                    };

                }

            }


        } else {

            eschmeyer = {

                encontrado: false

            };

        }


    // =================================================
    // OUTROS RANKS
    // =================================================

    } else {

        eschmeyer = {

            encontrado: false,

            motivo:
                "O Eschmeyer não possui consulta direta para este rank."

        };

    }


} catch (erroEschmeyer) {

    console.error(
        "Erro ao consultar Eschmeyer:",
        erroEschmeyer
    );


    eschmeyer = {

        encontrado: false,

        erro:
            "Não foi possível consultar o Eschmeyer."

    };

}

// =====================================================
// iNATURALIST
// =====================================================

try {

    const urlINaturalist =
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(nome)}&per_page=20`;

    const respostaINaturalist =
        await fetch(urlINaturalist);

    const dadosINaturalist =
        await respostaINaturalist.json();

    const resultadosINaturalist =
        Array.isArray(dadosINaturalist.results)
            ? dadosINaturalist.results
            : [];

    // Mantém somente nomes científicos exatamente iguais
    // ao nome pesquisado
    const resultadosExatos =
        resultadosINaturalist.filter(taxon =>
            taxon.name?.toLowerCase() ===
            nome.toLowerCase()
        );

    const processarINaturalist =
        (taxon) => {

            return {

                id:
                    taxon.id,

                nome:
                    taxon.name || null,

                nomeComum:
                    taxon.preferred_common_name || null,

                rank:
                    taxon.rank || null,

                reino:
                    taxon.rank === "kingdom"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "kingdom"
                        )?.name || null,

                filo:
                    taxon.rank === "phylum"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "phylum"
                        )?.name || null,

                classe:
                    taxon.rank === "class"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "class"
                        )?.name || null,

                ordem:
                    taxon.rank === "order"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "order"
                        )?.name || null,

                familia:
                    taxon.rank === "family"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "family"
                        )?.name || null,

                genero:
                    taxon.rank === "genus"
                        ? taxon.name
                        : taxon.ancestors?.find(
                            item => item.rank === "genus"
                        )?.name || null,

                wikipedia:
                    taxon.wikipedia_url || null,

                observacoes:
                    taxon.observations_count || 0
            };
        };

    if (resultadosExatos.length === 1) {

        inaturalist = {

            encontrado: true,

            ...processarINaturalist(
                resultadosExatos[0]
            )
        };

    } else if (resultadosExatos.length > 1) {

        inaturalist = {

            encontrado: true,

            homonimos: true,

            resultados:
                resultadosExatos.map(
                    processarINaturalist
                )
        };

    } else {

        inaturalist = {

            encontrado: false
        };
    }

} catch (erroINaturalist) {

    console.error(
        "Erro ao consultar iNaturalist:",
        erroINaturalist
    );

    inaturalist = {

        encontrado: false,

        erro:
            "Não foi possível consultar o iNaturalist."
    };
}

// =====================================================
// NCBI TAXONOMY
// =====================================================

try {

    const urlNCBISearch =
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=taxonomy&term=${encodeURIComponent(nome)}&retmode=json`;

    const respostaNCBISearch =
        await fetch(urlNCBISearch);

    const dadosNCBISearch =
        await respostaNCBISearch.json();

    const ids =
        dadosNCBISearch.esearchresult?.idlist;

    if (Array.isArray(ids) && ids.length > 0) {

        const resultadosNCBI = [];

        for (const taxid of ids) {

            const urlNCBIFetch =
                `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=taxonomy&id=${taxid}`;

            const respostaNCBIFetch =
                await fetch(urlNCBIFetch);

            const textoNCBIFetch =
                await respostaNCBIFetch.text();

            const extrairTag =
                (tag, conteudo) => {

                    const regex =
                        new RegExp(
                            `<${tag}>([\\s\\S]*?)</${tag}>`
                        );

                    const resultado =
                        conteudo.match(regex);

                    return resultado
                        ? resultado[1].trim()
                        : null;
                };

            const taxidXML =
                extrairTag(
                    "TaxId",
                    textoNCBIFetch
                );

            const nomeNCBI =
                extrairTag(
                    "ScientificName",
                    textoNCBIFetch
                );

            const rankNCBI =
                extrairTag(
                    "Rank",
                    textoNCBIFetch
                );

            const autoridade =
                extrairTag(
                    "DispName",
                    textoNCBIFetch
                );

            const lineageMatch =
                textoNCBIFetch.match(
                    /<LineageEx>([\s\S]*?)<\/LineageEx>/
                );

            const lineage =
                lineageMatch
                    ? lineageMatch[1]
                    : "";

            const encontrarRank =
                (rank) => {

                    const taxa =
                        lineage.match(
                            /<Taxon>[\s\S]*?<\/Taxon>/g
                        );

                    if (!taxa) {
                        return null;
                    }

                    for (const taxon of taxa) {

                        const nomeTaxon =
                            taxon.match(
                                /<ScientificName>([\s\S]*?)<\/ScientificName>/
                            );

                        const rankTaxon =
                            taxon.match(
                                /<Rank>([\s\S]*?)<\/Rank>/
                            );

                        if (
                            nomeTaxon &&
                            rankTaxon &&
                            rankTaxon[1].trim() === rank
                        ) {
                            return nomeTaxon[1].trim();
                        }
                    }

                    return null;
                };

            if (taxidXML && nomeNCBI) {

                resultadosNCBI.push({

                    taxid:
                        taxidXML,

                    nome:
                        nomeNCBI,

                    autoria:
                        autoridade,

                    rank:
                        rankNCBI,

                    reino:
                        rankNCBI === "kingdom"
                            ? nomeNCBI
                            : encontrarRank("kingdom"),

                    filo:
                        rankNCBI === "phylum"
                            ? nomeNCBI
                            : encontrarRank("phylum"),

                    classe:
                        rankNCBI === "class"
                            ? nomeNCBI
                            : encontrarRank("class"),

                    ordem:
                        rankNCBI === "order"
                            ? nomeNCBI
                            : encontrarRank("order"),

                    familia:
                        rankNCBI === "family"
                            ? nomeNCBI
                            : encontrarRank("family"),

                    genero:
                        rankNCBI === "genus"
                            ? nomeNCBI
                            : encontrarRank("genus")
                });
            }
        }

        if (resultadosNCBI.length === 1) {

            ncbi = {
                encontrado: true,
                ...resultadosNCBI[0]
            };

        } else if (resultadosNCBI.length > 1) {

            ncbi = {
                encontrado: true,
                homonimos: true,
                resultados: resultadosNCBI
            };

        } else {

            ncbi = {
                encontrado: false
            };
        }

    } else {

        ncbi = {
            encontrado: false
        };
    }

} catch (erroNCBI) {

    console.error(
        "Erro ao consultar NCBI Taxonomy:",
        erroNCBI
    );

    ncbi = {
        encontrado: false,
        erro:
            "Não foi possível consultar o NCBI Taxonomy."
    };
}

        // =====================================================
    // RESPOSTA FINAL
    // =====================================================

res.json({

    consulta:
        nome,

    checklistbank:
        checklistbank,

    worms:
        worms,

    eschmeyer:
        eschmeyer,

    inaturalist:
        inaturalist,

    ncbi:
        ncbi,

    wikipedia:
       wikipedia,

   wikispecies: wikispecies,
   academico: academico

});

});


// =====================================================
// INICIA O SERVIDOR
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Servidor funcionando na porta ${PORT}`
    );

});