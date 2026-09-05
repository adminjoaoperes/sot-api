const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// Página inicial
app.get("/", (req, res) => {
    res.send("SOT API funcionando!");
});


// Consulta o ChecklistBank
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

        // Monta a URL do ChecklistBank
        const url =
            `https://api.checklistbank.org/dataset/3LR/match/nameusage?q=${encodeURIComponent(nome)}`;

        // Faz a consulta ao ChecklistBank
        const resposta = await fetch(url);

        // Converte a resposta para JSON
        const dados = await resposta.json();

        // Pega os dados principais do táxon
const uso = dados.usage;

        // Se o ChecklistBank não encontrou o táxon
if (!uso) {
	res.status(404).json({
    		encontrado: false,
    	erro: "Táxon não encontrado."
	});
}

// Começa a montar a classificação
const classificacao = {};

// Se o próprio táxon for uma família
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

// Envia uma resposta simplificada
res.json({
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
});

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Não foi possível consultar o ChecklistBank."
        });

    }
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor funcionando na porta ${PORT}`);
});