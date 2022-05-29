import makeWASocket, { DisconnectReason, useSingleFileAuthState } from '@adiwajshing/baileys'
import { Boom } from '@hapi/boom'

async function connectToWhatsApp () {
    var exibiuBoasVindas = false;
    var enviouParaAtendente = false;
    var pendenteFinalizacao = false;
    var pendenteAvaliacao = false;

    const { state, saveState } = useSingleFileAuthState('./auth_info_multi.json')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    
    })

    //Variavel dos dados dos clientes
    const data = [
        {
            pedido: 123456,
            status: "Em Andamento...",
            telefone: "5528999049701"
        },
        {
            pedido: 654321,
            status: "Finalizado!",
            telefone: "5528999877108"
        },
        {
            pedido: 987654,
            status: "A caminho!",
            telefone: "5528999852542"
        }
    ];

    //Tentativas de conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            //console.log('opened connection')
        }
    })
    
    //Finalizando o atendimento
    sock.ev.on('messages.upsert', async m => {
        //console.log(JSON.stringify(m, undefined, 2))
        const msg = m.messages[0]
        const msgText = msg.message?.conversation
        //console.log('replying to', m.messages[0].key.remoteJid)
            if(!msg.key.fromMe) {
                if(m.type === 'notify') {
                    if(msgText) {
                        if (!enviouParaAtendente) {
                            await boasVindas(sock, m, msgText);
                        } else {
                            if (pendenteFinalizacao && validaFinalizacao(msgText.toLowerCase())) {
                                pendenteFinalizacao = false;
                                pendenteAvaliacao = true;

                                var message = `Disponha, qualquer dúvida estamos a disposição!🤝 Vou encerrar nosso atendimento. \n Não vá embora ainda! Responda a pesquisa de satisfação e avalie meu atendimento.`; 
                                await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `🤖 ${message}` });

                                var avaliacao = `Sua opinião é muito importante!\n Avalie esse atendimento conforme as opções disponíveis.\n\n A - Ótimo\n B - Bom\n C - Regular\n D - Ruim\n E - Péssimo`; 
                                await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `🤖 ${avaliacao}` });
                            }

                            if (pendenteAvaliacao && validaAvaliacao(msgText.toLowerCase())) {
                                pendenteAvaliacao = false;
                                exibiuBoasVindas = false;
                                enviouParaAtendente = false;

                                var message = `Obrigado pela avaliação, atendimento encerrado.`; 
                                await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `✅ ${message}` });
                            }

                            if (!pendenteFinalizacao && pendenteAvaliacao) {
                                var erro = `Opção inválida, por favor, selecione uma opção válida.`; 
                                await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `⛔ ${erro}` });
                            }
                        }
                    }
                };
            } else {
                if (validaAtendimento(msgText.toLowerCase())) {
                    pendenteFinalizacao = true;
                }
            };
        }
    )
    
    sock.ev.on('creds.update', saveState); //cache

    //Inicio do atendimento
    async function boasVindas(sock, m, msgText: string) {
        if (!exibiuBoasVindas) {
            var message = `Olá, seja bem vindo ao SAC da Chef Mio. Por favor, digite a opção abaixo que deseja: \n 1 - Status do pedido. \n 2 - Falar com um de nossos atendentes.`;
            await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `🤖 ${message}` });
            exibiuBoasVindas = true;
        } else {
            switch (msgText) {
                case "1":
                    await statusPedido(sock, m);
                    break;
                
                case "2":
                    await falarAtendente(sock, m);
                    break;

                default:
                    var message = `Comando inválido. Por favor, digite uma das opções do menu: \n 1 - Status do pedido. \n 2 - Falar com um de nossos atendentes.`;
                    await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `⛔ ${message}` });
                    break;
            };
        };
    };

    //Consulta de pedido
    async function statusPedido(sock, m) {
        var resultado = data.find(x => x.telefone == m.messages[0].key.remoteJid.replace("@s.whatsapp.net", ""));
        if (resultado) {
            var message = `Nome: ${m.messages[0].pushName} \n Pedido: ${resultado?.pedido} \n Status: ${resultado?.status}` 
            await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `🤖 ${message}` });
        } else {
            var message = `Não foi encontrado nenhum pedido com seu número de telefone.` 
            await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `⛔ ${message}` });
        };
    };

    //Conversa com atendente
    async function falarAtendente(sock, m) {
        var message = `Aguarde até que um de nossos atendentes possa te atender...`;
        await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `👩‍💼 ${message}` });
        enviouParaAtendente = true;

        setTimeout( async() => {
            var atendente = `Redirecionando para o atendente...`;
            await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `👩‍💼 ${atendente}` });

            setTimeout( async() => {
                var atendente = `Olá ${m.messages[0].pushName}, me chamo Gustavo, em que posso te ajudar?`;
                await sock.sendMessage(m.messages[0].key.remoteJid!, { text: `👨‍💼 ${atendente}` });
            }, 2000);
        }, 3000);
    };

    //Validação de expressões
    function validaAtendimento(texto: string) {
        if (texto == "finalizar" || "finaliza" || "finalizo" || "finalizado" || "finalizada" || "atendimento")
            return true;

        return false;
    };

    //Validação de expressões
    function validaAvaliacao(texto: string) { 
        if (texto == "a" || texto == "b" || texto == "c" || texto == "d" || texto == "e")
            return true;

        return false;
    };

    //Validação de expressões
    function validaFinalizacao(texto: string) {
        if (texto == "sim" || texto == "ok" || texto == "obrigado" || texto == "obrigada")
            return true;

        return false;
    };
};

connectToWhatsApp()
 