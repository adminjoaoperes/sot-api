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

    const extinto =
        uso.labelHtml?.includes("†") || false;

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
                    classificacao.genero || null,

		extinto:
    			extinto

            };

        };

// -----------------------------------------
// PROCESSA OS RESULTADOS
// -----------------------------------------

const registros =
    usos.map(processarUso);

// -----------------------------------------
// BUSCA OS FILHOS DIRETOS
// -----------------------------------------

for (let i = 0; i < usos.length; i++) {

    const uso =
        usos[i];

    const id =
        uso.id || null;

    registros[i].filhosDiretos = {

        encontrado: false,

        total: 0,

        resultados: []

    };

    if (!id) {
        continue;
    }

    try {

        const urlFilhos =
            `https://api.checklistbank.org/dataset/3LR/tree/${encodeURIComponent(id)}/children`;

        const respostaFilhos =
            await fetch(urlFilhos);

        if (!respostaFilhos.ok) {
            continue;
        }

        const dadosFilhos =
            await respostaFilhos.json();

        const filhos =
            Array.isArray(dadosFilhos.result)
                ? dadosFilhos.result
                : [];

        registros[i].filhosDiretos = {

            encontrado: filhos.length > 0,

            total: filhos.length,

resultados:
    filhos.map(filho => ({

        id:
            filho.id || null,

        nome:
            filho.name || null,

        categoria:
            filho.rank || null,

        autoria:
            filho.authorship || null,

        extinto:
            filho.labelHtml?.includes("†") || false

    }))

        };

    } catch (erroFilhos) {

        console.error(
            "Erro ao consultar filhos diretos do ChecklistBank:",
            erroFilhos
        );

    }

}

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

    const registroPrincipal =
        registrosExatos[0];

    const resultadoPrincipal =
        processarWorms(registroPrincipal);

    // -----------------------------------------
    // BUSCA OS FILHOS DIRETOS
    // -----------------------------------------

    let filhosDiretos = {

        encontrado: false,

        total: 0,

        resultados: []

    };

    // Só busca filhos para um registro válido
    if (
        registroPrincipal.status === "accepted" &&
        registroPrincipal.AphiaID
    ) {

        try {

            const urlFilhosWorms =
                `https://www.marinespecies.org/rest/AphiaChildrenByAphiaID/${registroPrincipal.AphiaID}`;

            const respostaFilhosWorms =
                await fetch(urlFilhosWorms);

            if (respostaFilhosWorms.ok) {

                const dadosFilhosWorms =
                    await respostaFilhosWorms.json();

                const filhosAceitos =
                    Array.isArray(dadosFilhosWorms)
                        ? dadosFilhosWorms.filter(
                            filho =>
                                filho.status === "accepted"
                        )
                        : [];

                filhosDiretos = {

                    encontrado:
                        filhosAceitos.length > 0,

                    total:
                        filhosAceitos.length,

                    resultados:
                        filhosAceitos.map(
                            filho => ({

                                aphiaID:
                                    filho.AphiaID || null,

                                nome:
                                    filho.scientificname || null,

                                categoria:
                                    filho.rank || null,

                                autoria:
                                    filho.authority || null

                            })
                        )

                };

            }

        } catch (erroFilhosWorms) {

            console.error(
                "Erro ao consultar filhos diretos do WoRMS:",
                erroFilhosWorms
            );

        }

    }

    worms = {

        encontrado: true,

        ...resultadoPrincipal,

        filhosDiretos:
            filhosDiretos

    };

} else if (registrosExatos.length > 1) {

    worms = {

        encontrado: true,

        homonimos: true,

        resultados:
            registrosExatos.map(
                registro => ({

                    ...processarWorms(registro),

                    filhosDiretos: {

                        encontrado: false,

                        total: 0,

                        resultados: []

                    }

                })
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

    const nomePesquisado =
        nome.trim();

    const nomeNormalizado =
        nomePesquisado.toLowerCase();

    const partesNome =
        nomePesquisado.split(/\s+/);

    // =================================================
    // FUNÇÕES AUXILIARES
    // =================================================

    function limparHtml(texto) {

        return texto
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&bull;/g, "•")
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

    }


    function normalizarNome(texto) {

        return texto
            .trim()
            .toLowerCase();

    }

function detectarExtincao(texto) {

    const textoNormalizado =
        texto
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    // Casos que NÃO significam extinção completa
    if (
        /\bextinct in the wild\b/i.test(textoNormalizado) ||
        /\bextinct in many areas\b/i.test(textoNormalizado) ||
        /\bpossibly extinct\b/i.test(textoNormalizado) ||
        /\bprobably extinct\b/i.test(textoNormalizado) ||
        /\bapparently extinct\b/i.test(textoNormalizado)
    ) {
        return false;
    }

    // Extinção completa explicitamente indicada pelo catálogo
    if (
        /\bbut extinct\b/i.test(textoNormalizado)
    ) {
        return true;
    }

    if (
        /\[extinct\]/i.test(textoNormalizado)
    ) {
        return true;
    }

    return false;
}

    function criarFilhosVazios() {

        return {

            encontrado: false,

            total: 0,

            resultados: []

        };

    }


    function criarFilhos(resultados) {

        return {

            encontrado:
                resultados.length > 0,

            total:
                resultados.length,

            resultados:
                resultados

        };

    }


    // =================================================
    // CONSULTA A CLASSIFICAÇÃO OFICIAL
    // =================================================

async function obterClassificacaoEschmeyer() {

    const urlClassificacao =
        "https://www.calacademy.org/eschmeyers-catalog-of-fishes-classification";

    const resposta =
        await fetch(urlClassificacao);

    if (!resposta.ok) {

        return [];

    }

    const html =
        await resposta.text();


    // -------------------------------------------------
    // Localiza todos os itens <li> da classificação
    // -------------------------------------------------

    const itens =
        html.match(
            /<li\b[^>]*>[\s\S]*?<\/li>/gi
        );


    if (!itens) {

        return [];

    }


    const resultados = [];


    // -------------------------------------------------
    // Converte cada item em um registro taxonômico
    // -------------------------------------------------

    for (const item of itens) {

        const texto =
            limparHtml(item);

	const extinto =
    		detectarExtincao(texto);

        // ---------------------------------------------
        // Identifica o rank
        // ---------------------------------------------

        const rankMatch =
            texto.match(
                /(?:^|\s)(Class|Order|Suborder|Family|Subfamily)\s+/i
            );


        if (!rankMatch) {

            continue;

        }


        const rank =
            rankMatch[1].toLowerCase();


        // ---------------------------------------------
        // Remove o rank
        // ---------------------------------------------

        const restante =
            texto
                .replace(
                    /.*?(Class|Order|Suborder|Family|Subfamily)\s+/i,
                    ""
                )
                .trim();


        // ---------------------------------------------
        // O nome do táxon aparece antes da autoria
        // ou da descrição entre parênteses.
        // ---------------------------------------------

        const nomeMatch =
            restante.match(
                /^("[^"]+"|[A-Z][A-Za-z-]*(?:\s+clade)?)/ 
            );


        if (!nomeMatch) {

            continue;

        }


        const nomeTaxon =
            nomeMatch[1].trim();


resultados.push({

    nome:
        nomeTaxon,

    rank:
        rank,

    paiTaxon:
        null,

    extinto:
        extinto

});

    }


    // -------------------------------------------------
    // Reconstrói a hierarquia
    // -------------------------------------------------

    const ordemRanks = {

        class: 1,

        order: 2,

        suborder: 3,

        family: 4,

        subfamily: 5

    };


    const pilha =
        [];


    for (const registro of resultados) {

        const nivel =
            ordemRanks[registro.rank];


        if (!nivel) {

            continue;

        }


        while (
            pilha.length > 0 &&
            ordemRanks[
                pilha[pilha.length - 1].rank
            ] >= nivel
        ) {

            pilha.pop();

        }


        registro.paiTaxon =
            pilha.length > 0
                ? pilha[pilha.length - 1]
                : null;


        pilha.push(registro);

    }


    return resultados;

}
    
    // =================================================
    // CONSULTA DE GÊNEROS
    // =================================================

    async function obterGenerosEschmeyer(nomeGrupo) {

        const urlGeneros =
            `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=genus&family=${encodeURIComponent(nomeGrupo)}`;

        const resposta =
            await fetch(urlGeneros);

        if (!resposta.ok) {

            return [];

        }


        const html =
            await resposta.text();


        const registros =
            html.match(
                /<p class="result"[\s\S]*?<\/p>/gi
            );


        if (!registros) {

            return [];

        }


        const resultados = [];


        for (const registro of registros) {

            const texto =
                limparHtml(registro);

		const extinto =
    			detectarExtincao(texto);

            /*
             * Somente gêneros válidos entram nos
             * filhos diretos.
             */

            const statusMatch =
                texto.match(
                    /Current status:\s*(.*?)(?:\.\s+Labridae:|\.\s+[A-Z][A-Za-z-]+idae:|$)/i
                );


            const status =
                statusMatch
                    ? statusMatch[1].trim()
                    : null;


            if (
                !status ||
                !status.startsWith("Valid as ")
            ) {

                continue;

            }


            const nomeMatch =
                status.match(
                    /^Valid as\s+([A-Z][A-Za-z-]*)/i
                );


            if (!nomeMatch) {
                continue;
            }


            const nomeGenero =
                nomeMatch[1];


            const genidMatch =
                registro.match(
                    /genid="(\d+)"/i
                );


            const id =
                genidMatch
                    ? genidMatch[1]
                    : null;


resultados.push({

    id:
        id,

    nome:
        nomeGenero,

    categoria:
        "genus",

    autoria:
        null,

    extinto:
        extinto

});

        }


        // ---------------------------------------------
        // Remove duplicidades
        // ---------------------------------------------

        const unicos = [];


        for (const resultado of resultados) {

            if (
                !unicos.some(
                    item =>
                        normalizarNome(item.nome) ===
                        normalizarNome(resultado.nome)
                )
            ) {

                unicos.push(resultado);

            }

        }


        return unicos;

    }


    // =================================================
    // CONSULTA DE ESPÉCIES
    // =================================================

    async function obterEspeciesEschmeyer(nomeGenero) {

        const urlEspecies =
            `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=species&genus=${encodeURIComponent(nomeGenero)}`;


        const resposta =
            await fetch(urlEspecies);


        if (!resposta.ok) {

            return [];

        }


        const html =
            await resposta.text();


        const registros =
            html.match(
                /<p class="result"[\s\S]*?<\/p>/gi
            );


        if (!registros) {

            return [];

        }


        const resultados = [];


        for (const registro of registros) {

            const texto =
                limparHtml(registro);

const extinto =
    detectarExtincao(texto);

            const statusMatch =
                texto.match(
                    /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z-]+idae(?::\s+[A-Z][A-Za-z-]+)?\.)/i
                );


            const status =
                statusMatch
                    ? statusMatch[1].trim()
                    : null;


            /*
             * Só nomes atualmente válidos entram
             * como filhos diretos.
             */

            if (
                !status ||
                !status.startsWith("Valid as ")
            ) {

                continue;

            }


            const nomeValidoMatch =
                status.match(
                    /^Valid as\s+([A-Z][A-Za-z-]+\s+[a-z][A-Za-z-]+)/i
                );


            if (!nomeValidoMatch) {
                continue;
            }


            const nomeEspecie =
                nomeValidoMatch[1];


            const idMatch =
                registro.match(
                    /spid="(\d+)"/i
                );


            const id =
                idMatch
                    ? idMatch[1]
                    : null;


            const familiaMatch =
                texto.match(
                    /\b([A-Z][A-Za-z-]+idae)\s*:/i
                );


            const familia =
                familiaMatch
                    ? familiaMatch[1]
                    : null;


            const habitatMatch =
                texto.match(
                    /Habitat:\s*(.*?)(?:\.|$)/i
                );


            const habitat =
                habitatMatch
                    ? habitatMatch[1]
                    : null;


            resultados.push({

                id:
                    id,

                nome:
                    nomeEspecie,

                categoria:
                    "species",

                autoria:
                    null,

familia:
    familia,

habitat:
    habitat,

extinto:
    extinto

});

        }


        const unicos = [];


        for (const resultado of resultados) {

            if (
                !unicos.some(
                    item =>
                        normalizarNome(item.nome) ===
                        normalizarNome(resultado.nome)
                )
            ) {

                unicos.push(resultado);

            }

        }


        return unicos;

    }


    // =================================================
    // IDENTIFICAÇÃO DE ESPÉCIE / SINÔNIMO
    // =================================================

    async function consultarEspecieEschmeyer(
        nomeCompleto
    ) {

        const partesNome =
            nomeCompleto.split(/\s+/);


        if (partesNome.length < 2) {

            return null;

        }


        const genero =
            partesNome[0];


        const especie =
            partesNome[1];


        const urlEspecie =
            `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=species&genus=${encodeURIComponent(genero)}&species=${encodeURIComponent(especie)}`;


        const resposta =
            await fetch(urlEspecie);


        if (!resposta.ok) {

            return null;

        }


        const html =
            await resposta.text();


        const registros =
            html.match(
                /<p class="result"[\s\S]*?<\/p>/gi
            );


        if (!registros) {

            return null;

        }


        const resultados = [];


        for (const registro of registros) {

            const texto =
                limparHtml(registro);

const extinto =
    detectarExtincao(texto);

            const idMatch =
                registro.match(
                    /spid="(\d+)"/i
                );


            const id =
                idMatch
                    ? idMatch[1]
                    : null;


            const statusMatch =
                texto.match(
                    /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z-]+idae(?::\s+[A-Z][A-Za-z-]+)?\.)/i
                );


            const status =
                statusMatch
                    ? statusMatch[1].trim()
                    : null;


            const familiaMatch =
                texto.match(
                    /Current status:.*?\.\s+([A-Z][A-Za-z-]+idae)(?::\s+[A-Z][A-Za-z-]+)?\./i
                );


            const familia =
                familiaMatch
                    ? familiaMatch[1]
                    : null;


            const habitatMatch =
                texto.match(
                    /Habitat:\s*(.*?)(?:\.|$)/i
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
                    nomeCompleto,

                status:
                    status,

                nomeAceito:
                    nomeAceito,

                familia:
                    familia,

		habitat:
    			habitat,

		extinto:
    			extinto

});

        }


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
        .replace(
            "Valid as ",
            ""
        )
        .trim();


const nomeAceitoMatch =
    nomeDepoisValidAs.match(
        /^([A-Z][A-Za-z-]+\s+[a-z][A-Za-z-]+)/
    );


const nomeTaxonomicoAceito =
    nomeAceitoMatch
        ? nomeAceitoMatch[1]
        : nomeDepoisValidAs;


const ehSinonimo =
    normalizarNome(
        nomeTaxonomicoAceito
    ) !==
    normalizarNome(
        nomeCompleto
    );


            return {

                encontrado: true,

                tipo:
                    ehSinonimo
                        ? "sinonimo"
                        : "valido",

                categoria:
                    "species",

                id:
                    registroValido.id,

                nome:
                    registroValido.nome,

                status:
                    registroValido.status,

		nomeAceito:
    			ehSinonimo
        		? nomeTaxonomicoAceito
        		: null,

familia:
    registroValido.familia,

habitat:
    registroValido.habitat,

extinto:
    registroValido.extinto

};

        }


        const registroSinonimo =
            resultados.find(
                registro =>
                    registro.status &&
                    registro.status.startsWith(
                        "Synonym of "
                    )
            );


        if (registroSinonimo) {

            return {

                encontrado: true,

                tipo:
                    "sinonimo",

                categoria:
                    "species",

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
    registroSinonimo.habitat,

extinto:
    registroSinonimo.extinto

};

        }


        return {

            encontrado: true,

            tipo:
                "incerto",

            categoria:
                "species",

            resultados:
                resultados

        };

    }


    // =================================================
    // BUSCA A CLASSIFICAÇÃO
    // =================================================

    const classificacao =
        await obterClassificacaoEschmeyer();


    // =================================================
    // PROCURA O TÁXON NA CLASSIFICAÇÃO
    // =================================================

    const registroClassificacao =
        classificacao.find(
            registro =>
                normalizarNome(registro.nome) ===
                nomeNormalizado
        );


    // =================================================
    // TÁXON ENCONTRADO NA CLASSIFICAÇÃO
    // =================================================

    if (registroClassificacao) {

        const rank =
            registroClassificacao.rank;


        const filhos =
            classificacao.filter(
                registro =>
                    registro.paiTaxon ===
                    registroClassificacao
            );


        let filhosDiretos =
            [];


        // ---------------------------------------------
        // Filhos da classificação superior
        // ---------------------------------------------

        if (
            filhos.length > 0
        ) {

filhosDiretos =
    filhos.map(
        filho => ({

            id:
                null,

            nome:
                filho.nome,

            categoria:
                filho.rank,

            autoria:
                null,

            extinto:
                filho.extinto === true

        })
    );

        }


        // ---------------------------------------------
        // Se o táxon é família ou subfamília e não
        // possui filhos na classificação, procuramos
        // os gêneros diretamente associados.
        // ---------------------------------------------

        if (
            filhosDiretos.length === 0 &&
            (
                rank === "family" ||
                rank === "subfamily"
            )
        ) {

            filhosDiretos =
                await obterGenerosEschmeyer(
                    nomePesquisado
                );

        }

let extintoTaxon =
    registroClassificacao.extinto === true;

if (
    (
        rank === "genus" ||
        rank === "family" ||
        rank === "subfamily"
    ) &&
    filhosDiretos.length > 0
) {

    extintoTaxon =
        filhosDiretos.every(
            filho =>
                filho.extinto === true
        );

}

eschmeyer = {

    encontrado: true,

    tipo:
        "valido",

    categoria:
        rank,

    nome:
        registroClassificacao.nome,

extinto:
    extintoTaxon,

    filhosDiretos:
        criarFilhos(
            filhosDiretos
        )

};


    } else {

        // =================================================
        // NÃO ENCONTRADO NA CLASSIFICAÇÃO:
        // TENTAMOS COMO GÊNERO
        // =================================================

        if (
            partesNome &&
            partesNome.length === 1
        ) {

            const especiesGenero =
                await obterEspeciesEschmeyer(
                    nomePesquisado
                );


            if (
                especiesGenero.length > 0
            ) {

const extintoGenero =
    especiesGenero.length > 0 &&
    especiesGenero.every(
        especie =>
            especie.extinto === true
    );

                eschmeyer = {

                    encontrado: true,

                    tipo:
                        "valido",

                    categoria:
                        "genus",

                    nome:
                        nomePesquisado,

extinto:
    extintoGenero,

                    filhosDiretos:
                        criarFilhos(
                            especiesGenero
                        )

                };

            } else {

                eschmeyer = {

                    encontrado: false,

                    nome:
                        nomePesquisado

                };

            }

        } else {

            // =================================================
            // TENTAMOS COMO ESPÉCIE
            // =================================================

            const resultadoEspecie =
                await consultarEspecieEschmeyer(
                    nomePesquisado
                );


            if (resultadoEspecie) {

                /*
                 * Espécies não possuem, normalmente,
                 * filhos taxonômicos utilizados pelo
                 * catálogo.
                 *
                 * Portanto retornamos estrutura vazia.
                 */

                eschmeyer = {

                    ...resultadoEspecie,

                    filhosDiretos:
                        criarFilhosVazios()

                };

            } else {

                eschmeyer = {

                    encontrado: false

                };

            }

        }

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

extinto:
    taxon.extinct === true,

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

    // -------------------------------------------------
    // Busca os filhos diretos do táxon
    // -------------------------------------------------

    const obterFilhosDiretosINaturalist =
        async (taxon) => {

            if (!taxon?.id) {

                return {

                    encontrado: false,

                    total: 0,

                    resultados: []

                };

            }

            try {

                const urlTaxonINaturalist =
                    `https://api.inaturalist.org/v1/taxa/${taxon.id}`;

                const respostaTaxonINaturalist =
                    await fetch(
                        urlTaxonINaturalist
                    );

                if (!respostaTaxonINaturalist.ok) {

                    return {

                        encontrado: false,

                        total: 0,

                        resultados: []

                    };

                }

                const dadosTaxonINaturalist =
                    await respostaTaxonINaturalist.json();

const taxonDetalhado =
    Array.isArray(
        dadosTaxonINaturalist.results
    )
        ? dadosTaxonINaturalist.results[0]
        : null;

const filhos =
    Array.isArray(
        taxonDetalhado?.children
    )
        ? taxonDetalhado.children
        : [];

                // Mantém SOMENTE os filhos cujo
                // pai imediato é o táxon pesquisado
                const filhosDiretos =
                    filhos.filter(
                        filho =>
                            filho.parent_id ===
                            taxon.id
                    );

                return {

                    encontrado:
                        filhosDiretos.length > 0,

                    total:
                        filhosDiretos.length,

                    resultados:
                        filhosDiretos.map(
                            filho => ({

                                id:
                                    filho.id || null,

nome:
    filho.name || null,

extinto:
    filho.extinct === true,

categoria:
    filho.rank || null,

                                nomeComum:
                                    filho.preferred_common_name ||
                                    null

                            })
                        )

                };

            } catch (erroFilhosINaturalist) {

                console.error(
                    "Erro ao consultar filhos diretos do iNaturalist:",
                    erroFilhosINaturalist
                );

                return {

                    encontrado: false,

                    total: 0,

                    resultados: []

                };

            }

        };


    if (resultadosExatos.length === 1) {

        const resultadoPrincipal =
            processarINaturalist(
                resultadosExatos[0]
            );

        const filhosDiretos =
            await obterFilhosDiretosINaturalist(
                resultadosExatos[0]
            );

        inaturalist = {

            encontrado: true,

            ...resultadoPrincipal,

            filhosDiretos:
                filhosDiretos

        };

    } else if (resultadosExatos.length > 1) {

        const resultadosHomonimos =
            [];

        for (
            const taxon of resultadosExatos
        ) {

            const resultado =
                processarINaturalist(
                    taxon
                );

            const filhosDiretos =
                await obterFilhosDiretosINaturalist(
                    taxon
                );

            resultadosHomonimos.push({

                ...resultado,

                filhosDiretos:
                    filhosDiretos

            });

        }

        inaturalist = {

            encontrado: true,

            homonimos: true,

            resultados:
                resultadosHomonimos

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