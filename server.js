const express = require("express");

const app = express();

const cors = require("cors");

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
// CONSULTA TAXONÔMICA
// CHECKLISTBANK + WORMS + ESCHMEYER
// =====================================================

app.get("/api/taxon", async (req, res) => {

    // Pega o nome enviado na URL
    const nome = req.query.q;

    // Verifica se o usuário informou um nome
    if (!nome) {
        return res.status(400).json({
            erro: "Informe um nome científico."
        });
    }

    try {

        // =====================================================
        // CHECKLISTBANK
        // =====================================================

        const urlChecklistBank =
            `https://api.checklistbank.org/dataset/3LR/match/nameusage?q=${encodeURIComponent(nome)}`;

        const respostaChecklistBank =
            await fetch(urlChecklistBank);

        const dadosChecklistBank =
            await respostaChecklistBank.json();

        const uso = dadosChecklistBank.usage;

        let checklistbank = null;

        if (uso) {

let nomeAceito = null;

if (uso.status === "synonym") {

    const registroAceito =
        uso.classification?.find(
            item =>
item.status === "accepted" &&
(
    item.rank === "species" ||
    item.rank === "family"
)
        );

    if (registroAceito) {
        nomeAceito = registroAceito.name;
    }
}

            const classificacao = {};

            if (uso.rank === "family") {
                classificacao.familia = uso.name;
            }

let especiesChecklistBank = [];

async function buscarDescendentesChecklistBank(id) {

    const url =
        `https://api.checklistbank.org/dataset/3LR/tree/${id}/children`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!dados.result) {
        return;
    }

    for (const filho of dados.result) {

        // Se encontrou uma espécie, adiciona à lista
        if (filho.rank === "species") {

            especiesChecklistBank.push({

                id: filho.id,
                nome: filho.name,
                autoria: filho.authorship || null,
                status: filho.status || null

            });

            continue;
        }

        // Se ainda não chegou às espécies,
        // continua descendo pela árvore
        if (filho.childCount > 0) {

            await buscarDescendentesChecklistBank(filho.id);

        }

    }

}

if (uso.rank === "family") {

    try {

        await buscarDescendentesChecklistBank(uso.id);

    } catch (erro) {

        console.log(
            "Erro ao buscar espécies do ChecklistBank:",
            erro.message
        );

    }

}

            checklistbank = {

                encontrado: true,

                id: uso.id,

                nome: uso.name,

                autoria: uso.authorship || null,

                rank: uso.rank,

                status: uso.status,

		nomeAceito: nomeAceito,

	        especies: especiesChecklistBank,

                reino: classificacao.reino || null,

                filo: classificacao.filo || null,

                classe: classificacao.classe || null,

                ordem: classificacao.ordem || null,

                familia: classificacao.familia || null

            };

        }


    // =====================================================
// WORMS
// =====================================================

let worms = null;

async function buscarEspeciesWorms(aphiaID) {

    let especies = [];
    let offset = 1;

    while (true) {

        const url =
            `https://www.marinespecies.org/rest/AphiaRecordsByTaxonRankID/220?belongsTo=${aphiaID}&offset=${offset}`;

        const resposta = await fetch(url);

        const dados = await resposta.json();

        if (!Array.isArray(dados) || dados.length === 0) {
            break;
        }

        especies.push(...dados);

        if (dados.length < 50) {
            break;
        }

        offset += 50;
    }

    return especies;
}

try {

    const urlWormsID =
        `https://www.marinespecies.org/rest/AphiaIDByName/${encodeURIComponent(nome)}`;

    const respostaWormsID =
        await fetch(urlWormsID);

    const aphiaID =
        await respostaWormsID.text();

    if (aphiaID && aphiaID !== "null") {

        const urlWorms =
            `https://www.marinespecies.org/rest/AphiaRecordByAphiaID/${aphiaID}`;

        const respostaWorms =
            await fetch(urlWorms);

        const registro =
            await respostaWorms.json();

        worms = {

            encontrado: true,

            aphiaID: registro.AphiaID || null,

            nome: registro.scientificname || null,

            autoria: registro.authority || null,

            rank: registro.rank || null,

            status: registro.status || null,

            tipo:
                registro.valid_AphiaID &&
                registro.valid_AphiaID !== registro.AphiaID
                    ? "sinonimo"
                    : "valido",

            nomeAceito:
                registro.valid_AphiaID &&
                registro.valid_AphiaID !== registro.AphiaID
                    ? registro.valid_name || null
                    : null,

            aphiaIDAceito:
                registro.valid_AphiaID &&
                registro.valid_AphiaID !== registro.AphiaID
                    ? registro.valid_AphiaID
                    : null,

            autoriaNomeAceito:
                registro.valid_AphiaID &&
                registro.valid_AphiaID !== registro.AphiaID
                    ? registro.valid_authority || null
                    : null,

            reino: registro.kingdom || null,

            filo: registro.phylum || null,

            classe: registro.class || null,

            ordem: registro.order || null,

            familia: registro.family || null,

            genero: registro.genus || null,

            marinho: registro.isMarine === 1,

            salobra: registro.isBrackish === 1,

            aguaDoce: registro.isFreshwater === 1,

            terrestre: registro.isTerrestrial === 1,

            extinto: registro.isExtinct === 1

        };

        // =================================================
        // BUSCA ESPÉCIES QUANDO A CONSULTA É UMA FAMÍLIA
        // =================================================

        if (registro.rank === "Family") {

            try {

                const especiesWorms =
                    await buscarEspeciesWorms(
                        registro.AphiaID
                    );

                worms.especies =
                    especiesWorms.map(especie => ({

                        aphiaID:
                            especie.AphiaID || null,

                        nome:
                            especie.scientificname || null,

                        autoria:
                            especie.authority || null,

                        status:
                            especie.status || null,

                        nomeAceito:
                            especie.valid_AphiaID &&
                            especie.valid_AphiaID !== especie.AphiaID
                                ? especie.valid_name || null
                                : null,

                        aphiaIDAceito:
                            especie.valid_AphiaID &&
                            especie.valid_AphiaID !== especie.AphiaID
                                ? especie.valid_AphiaID
                                : null,

                        autoriaNomeAceito:
                            especie.valid_AphiaID &&
                            especie.valid_AphiaID !== especie.AphiaID
                                ? especie.valid_authority || null
                                : null,

                        extinto:
                            especie.isExtinct === 1

                    }));

            } catch (erroEspeciesWorms) {

                console.error(
                    "Erro ao buscar espécies do WoRMS:",
                    erroEspeciesWorms
                );

                worms.especies = [];

            }

        } else {

            worms.especies = [];

        }

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

let eschmeyer = null;

try {

// =====================================================
// CONSULTA DE FAMÍLIA
// =====================================================

if (uso && uso.rank === "family") {

    const urlEschmeyer =
        `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=species&family=${encodeURIComponent(nome)}`;

    const respostaEschmeyer =
        await fetch(urlEschmeyer);

    const html =
        await respostaEschmeyer.text();

    // Encontra todos os registros
    const registros =
        html.match(
            /<p class="result"[\s\S]*?<\/p>/g
        );

    const especies = [];

    if (registros) {

        // =====================================================
        // PROCESSA CADA REGISTRO
        // =====================================================

        registros.forEach((registro) => {

            // -------------------------------------------------
            // ID
            // -------------------------------------------------

            const idMatch =
                registro.match(
                    /spid="(\d+)"/
                );

            const id =
                idMatch
                    ? idMatch[1]
                    : null;


            // -------------------------------------------------
            // CONVERTE HTML PARA TEXTO
            // -------------------------------------------------

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

            // =====================================================
            // STATUS
            // =====================================================

const statusMatch =
    texto.match(
        /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z]+idae(?::\s+[A-Z][A-Za-z]+)?\.)/
    );

            const status =
                statusMatch
                    ? statusMatch[1].trim()
                    : null;


            // =====================================================
            // FAMÍLIA
            // =====================================================

            const familiaMatch =
                texto.match(
                    /Current status:.*?\.\s+([A-Z][A-Za-z]+idae)\.?/
                );

            const familia =
                familiaMatch
                    ? familiaMatch[1]
                    : null;


            // =====================================================
            // HABITAT
            // =====================================================

            const habitatMatch =
                texto.match(
                    /Habitat:\s*(.*?)(?:\.|$)/
                );

            const habitat =
                habitatMatch
                    ? habitatMatch[1]
                    : null;

// =====================================================
// NOME DA ESPÉCIE
// =====================================================

let nomeEspecie = null;

let nameOnlyMatch = null;


// -------------------------------------------------
// 1. VALID AS — USA O STATUS ATUAL
// -------------------------------------------------

if (
    status &&
    status.startsWith("Valid as ")
) {

    const validAsMatch =
        status.match(
            /Valid as\s+([A-Z][a-z-]+\s+[a-z-]+)/
        );

    if (validAsMatch) {

        nomeEspecie =
            validAsMatch[1];

    }

}


// -------------------------------------------------
// 2. NAME ONLY AS
// -------------------------------------------------

if (!nomeEspecie) {

    nameOnlyMatch =
        texto.match(
            /Name only as\s+([A-Z][a-z-]+\s+[a-z-]+)/
        );

    if (nameOnlyMatch) {

        nomeEspecie =
            nameOnlyMatch[1];

    }

}


// -------------------------------------------------
// 3. NOME NO INÍCIO DO REGISTRO
// -------------------------------------------------

if (!nomeEspecie) {

    const nomeInicialMatch =
        texto.match(
            /^([a-z-]+)\s*,\s+([A-Z][a-z-]+)/
        );

    if (nomeInicialMatch) {

        nomeEspecie =
            nomeInicialMatch[2] +
            " " +
            nomeInicialMatch[1];

    }

}


// -------------------------------------------------
// 4. NOME CIENTÍFICO NORMAL
// -------------------------------------------------

if (!nomeEspecie) {

    const nomeMatch =
        texto.match(
            /^([A-Z][a-z-]+\s+[a-z-]+)/
        );

    if (nomeMatch) {

        nomeEspecie =
            nomeMatch[1];

    }

}
            
            // =====================================================
            // SINÔNIMO
            // =====================================================

            let sinonimoDe = null;

            if (
                status &&
                status.startsWith("Synonym of")
            ) {

                const sinonimoMatch =
                    status.match(
                        /Synonym of\s+([A-Z][a-z-]+\s+[a-z-]+)/
                    );

                if (sinonimoMatch) {

                    sinonimoDe =
                        sinonimoMatch[1];

                }

            }


            // =====================================================
            // REGISTRO
            // =====================================================

            especies.push({

                id,

                nome:
                    nomeEspecie,

                status,

                familia,

                habitat,

                sinonimoDe

            });

        });

    }


    // =====================================================
    // SEPARA ESPÉCIES VÁLIDAS
    // =====================================================

    const especiesValidas =
        especies.filter(
            especie =>
                especie.status &&
                especie.status.startsWith("Valid as ")
        );

    // =====================================================
    // SEPARA SINÔNIMOS
    // =====================================================

    const sinonimos =
        especies.filter(
            especie =>
                especie.status &&
                especie.status.startsWith("Synonym of ")
        );


    // =====================================================
    // AGRUPA SINÔNIMOS NAS ESPÉCIES VÁLIDAS
    // =====================================================

    especiesValidas.forEach((especieValida) => {

        especieValida.sinonimos =
            sinonimos
                .filter(
                    sinonimo =>
                        sinonimo.sinonimoDe ===
                        especieValida.nome
                )
                .map(
                    sinonimo =>
                        sinonimo.nome
                )
                .filter(Boolean);

    });


    // =====================================================
    // RESULTADO FINAL
    // =====================================================

    eschmeyer = {

        encontrado:
            especiesValidas.length > 0,

        tipo:
            "familia",

        nome:
            nome,

        quantidadeEspecies:
            especiesValidas.length,

        especies:
            especiesValidas

    };


    } else {

        // =====================================================
        // CONSULTA DE ESPÉCIE
        // =====================================================

        // Divide o nome em gênero e espécie
        const partes =
            nome.trim().split(/\s+/);

        const genero = partes[0];
        const especie = partes[1];

        // O Eschmeyer será consultado apenas
        // quando houver gênero + espécie
        if (genero && especie) {

            const urlEschmeyer =
                `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?tbl=species&genus=${encodeURIComponent(genero)}&species=${encodeURIComponent(especie)}`;

            const respostaEschmeyer =
                await fetch(urlEschmeyer);

            const html =
                await respostaEschmeyer.text();

            // Encontra todos os registros
            const registros =
                html.match(
                    /<p class="result"[\s\S]*?<\/p>/g
                );

            if (registros) {

                const resultados = [];

                registros.forEach((registro) => {

                    // ID
                    const idMatch =
                        registro.match(
                            /spid="(\d+)"/
                        );

                    const id =
                        idMatch
                            ? idMatch[1]
                            : null;


                    // Converte HTML para texto
                    const texto = registro

                        .replace(
                            /<[^>]*>/g,
                            " "
                        )

                        .replace(
                            /&bull;/g,
                            "•"
                        )

                        .replace(
                            /&amp;/g,
                            "&"
                        )

                        .replace(
                            /&#233;/g,
                            "é"
                        )

                        .replace(
                            /&#234;/g,
                            "ê"
                        )

                        .replace(
                            /&#225;/g,
                            "á"
                        )

                        .replace(
                            /&#243;/g,
                            "ó"
                        )

                        .replace(
                            /&#231;/g,
                            "ç"
                        )

                        .replace(
                            /&#269;/g,
                            "č"
                        )

                        .replace(
                            /&#263;/g,
                            "ć"
                        )

                        .replace(
                            /&#268;/g,
                            "Č"
                        )

                        .replace(
                            /&#252;/g,
                            "ü"
                        )

                        .replace(
                            /&#241;/g,
                            "ñ"
                        )

                        .replace(
                            /&#355;/g,
                            "ţ"
                        )

                        .replace(
                            /\s+/g,
                            " "
                        )

                        .trim();


                    // Status atual
			const statusMatch =
   			 texto.match(
			        /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z]+idae(?::\s+[A-Z][A-Za-z]+)?\.)/
			    );

                    const status =
                        statusMatch
                            ? statusMatch[1].trim()
                            : null;


                    // Família
	const familiaMatch =
	    texto.match(
	        /Current status:.*?\.\s+([A-Z][A-Za-z]+idae)(?::\s+[A-Z][A-Za-z]+)?\./
		    );

                    const familia =
                        familiaMatch
                            ? familiaMatch[1]
                            : null;


                    // Habitat
                    const habitatMatch =
                        texto.match(
                            /Habitat:\s*(.*?)(?:\.|$)/
                        );

                    const habitat =
                        habitatMatch
                            ? habitatMatch[1]
                            : null;


                    resultados.push({

                        id,

                        status,

                        familia,

                        habitat

                    });

                });


                // Procura primeiro um registro
                // que considere o nome válido
                const registroValido =
                    resultados.find(
                        registro =>
                            registro.status &&
                            registro.status.startsWith(
                                "Valid as " + nome
                            )
                    );


                if (registroValido) {

                    eschmeyer = {

                        encontrado: true,

                        tipo: "valido",

                        id:
                            registroValido.id,

                        status:
                            registroValido.status,

                        familia:
                            registroValido.familia,

                        habitat:
                            registroValido.habitat

                    };

                } else {

                    // Procura um sinônimo
                    const registroSinonimo =
                        resultados.find(
                            registro =>
                                registro.status &&
                                registro.status.startsWith(
                                    "Synonym of "
                                )
                        );


                    if (registroSinonimo) {

                        const nomeAceito =
                            registroSinonimo.status
                                .replace(
                                    "Synonym of ",
                                    ""
                                )
                                .trim();


                        eschmeyer = {

                            encontrado: true,

                            tipo: "sinonimo",

                            id:
                                registroSinonimo.id,

                            status:
                                registroSinonimo.status,

                            nomeAceito:
                                nomeAceito,

                            familia:
                                registroSinonimo.familia,

                            habitat:
                                registroSinonimo.habitat

                        };

                    } else {

                        // Existe registro, mas a situação
                        // não é válida nem sinônimo
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

        } else {

            eschmeyer = {

                encontrado: false,

                motivo:
                    "Consulta de espécie requer gênero e espécie."

            };

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
        // RESPOSTA FINAL
        // =====================================================

        res.json({

            consulta: nome,

            checklistbank: checklistbank,

            worms: worms,

            eschmeyer: eschmeyer

        });


    } catch (erro) {

        console.error(erro);

        res.status(500).json({

            erro:
                "Não foi possível consultar as fontes taxonômicas."

        });

    }

});


// =====================================================
// INICIA O SERVIDOR
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Servidor funcionando na porta ${PORT}`
    );

});
