const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;


// =====================================================
// PÁGINA INICIAL
// =====================================================

app.get("/", (req, res) => {
    res.send("SOT API funcionando!");
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

            const classificacao = {};

            if (uso.rank === "family") {
                classificacao.familia = uso.name;
            }

            if (uso.classification) {

                uso.classification.forEach((taxon) => {

                    if (taxon.rank === "kingdom") {
                        classificacao.reino = taxon.name;
                    }

                    if (taxon.rank === "phylum") {
                        classificacao.filo = taxon.name;
                    }

                    if (taxon.rank === "class") {
                        classificacao.classe = taxon.name;
                    }

                    if (taxon.rank === "order") {
                        classificacao.ordem = taxon.name;
                    }

                    if (taxon.rank === "family") {
                        classificacao.familia = taxon.name;
                    }

                });

            }

            checklistbank = {

                encontrado: true,

                id: uso.id,

                nome: uso.name,

                autoria: uso.authorship || null,

                rank: uso.rank,

                status: uso.status,

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

                    nomeAceito: registro.valid_name || null,

                    autoriaNomeAceito:
                        registro.valid_authority || null,

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
                                /Current status:\s*(.*?)(?:\.\s+[A-Z][A-Za-z]+idae\.)/
                            );

                        const status =
                            statusMatch
                                ? statusMatch[1].trim()
                                : null;


                        // Família
                        const familiaMatch =
                            texto.match(
                                /Current status:.*?\.\s+([A-Z][A-Za-z]+idae)\./
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

                            id: registroValido.id,

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