const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  Events,
  PermissionsBitField,
  AuditLogEvent,
} = require("discord.js");
const express = require("express");
require("dotenv").config();

const TOKEN = process.env.TOKEN;
const CANAL_LOGS = process.env.CANAL_LOGS;
const CANAL_SOLICITACOES = process.env.CANAL_SOLICITACOES; // canal para solicitações
const CARGO_APROVADO = process.env.CARGO_APROVADO;
const CARGO_REPROVADO = process.env.CARGO_REPROVADO;
const CARGO_STAFF = process.env.CARGO_STAFF;
const CARGO_APROVADOR = process.env.CARGO_APROVADOR; // cargo que pode aprovar/reprovar formulários e solicitações
const CARGO_SOLICITADOR = process.env.CARGO_SOLICITADOR; // cargo que pode enviar solicitações (!adicionar)
const CATEGORIA_CANAIS = process.env.CATEGORIA_CANAIS;
const CATEGORIA_TICKETS = process.env.CATEGORIA_TICKETS;
const CARGO_AUTOROLE = process.env.CARGO_AUTOROLE;
const PORT = process.env.PORT || 3000;

const app = express();
app.get("/", (req, res) => res.send("Bot Imperial Group online."));
app.listen(PORT, () => console.log(`🟢 Servidor HTTP ativo na porta ${PORT}.`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

const exclusoesCanal = new Map();

client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) {
    const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(() => null);
    if (canalLogs?.isTextBased()) {
      canalLogs.send(`⚠️ Bot ${member.user.tag} tentou entrar e foi removido.`);
    }
    try {
      await member.kick("Bots não são permitidos neste servidor.");
    } catch (err) {
      console.error("Erro ao expulsar bot:", err);
    }
  } else if (CARGO_AUTOROLE) {
    try {
      await member.roles.add(CARGO_AUTOROLE);
      console.log(`✅ Cargo automático adicionado para ${member.user.tag}`);
    } catch (err) {
      console.error("Erro ao adicionar cargo automático:", err);
    }
  }
});

client.on(Events.ChannelDelete, async (canal) => {
  try {
    const guild = canal.guild;
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1,
    });
    const entry = auditLogs.entries.first();
    if (!entry) return;
    const executor = entry.executor;
    if (!executor) return;

    // Canal deletado não será recriado

    if (!exclusoesCanal.has(executor.id)) {
      exclusoesCanal.set(executor.id, { count: 1 });
      setTimeout(() => exclusoesCanal.delete(executor.id), 5 * 60 * 1000);
    } else {
      const dados = exclusoesCanal.get(executor.id);
      dados.count++;
      exclusoesCanal.set(executor.id, dados);

      if (dados.count >= 4) {
        const membro = await guild.members.fetch(executor.id).catch(() => null);
        if (membro && membro.bannable) {
          await membro.ban({
            reason: "Excluiu 4 ou mais canais em curto período",
          });
          const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(() => null);
          if (canalLogs?.isTextBased()) {
            canalLogs.send(`🚨 Usuário ${executor.tag} banido por excluir vários canais.`);
          }
        }
        exclusoesCanal.delete(executor.id);
      }
    }
  } catch (error) {
    console.error("Erro no evento ChannelDelete:", error);
  }
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content === "!painel") {
    const embed = new EmbedBuilder()
      .setTitle("👑 Junte-se à Imperial Group")
      .setDescription("Clique no botão abaixo para preencher o formulário!")
      .setColor("#FF004C")
      .setThumbnail(msg.guild.iconURL())
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_formulario")
        .setLabel("📋 Formulário de Entrada")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
  }

  if (msg.content === "!painelticket") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Suporte - Abra seu Ticket")
      .setDescription("Clique no botão abaixo para abrir um ticket com a equipe de suporte.")
      .setColor("Blue")
      .setTimestamp()
      .setFooter({ text: "Sistema de Tickets" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_ticket")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
  }

  if (msg.content.startsWith("!atualizações")) {
    if (!msg.member.roles.cache.has(CARGO_STAFF)) {
      return msg.reply("❌ Você não tem permissão para enviar atualizações.");
    }

    const args = msg.content.split(" ").slice(1).join(" ");
    if (!args) {
      return msg.reply("❌ Escreva a mensagem de atualizações após o comando.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 Atualizações – Imperial Group")
      .setDescription(args)
      .setColor("#FF004C")
      .setThumbnail(msg.guild.iconURL())
      .setFooter({ text: `Anunciado por ${msg.author.tag}`, iconURL: msg.author.displayAvatarURL() })
      .setTimestamp();

    await msg.channel.send({ embeds: [embed] });
    await msg.react("✅");
  }

  // Comando !adicionar - somente para cargo solicitador
  if (msg.content.toLowerCase().startsWith("!adicionar")) {
    if (!msg.member.roles.cache.has(CARGO_SOLICITADOR)) {
      return msg.reply("❌ Você não tem permissão para usar este comando.");
    }

    const args = msg.content.trim().split(/ +/).slice(1);
    if (args.length < 4) {
      return msg.reply(
        "❌ Uso correto: `!adicionar <id> <nome da solicitação> <quantidade> <motivo>`"
      );
    }

    const [id, ...rest] = args;
    const qtdIndex = rest.findIndex((arg) => !isNaN(arg));
    if (qtdIndex === -1) {
      return msg.reply(
        "❌ Por favor, informe a quantidade como um número válido."
      );
    }

    const nome = rest.slice(0, qtdIndex).join(" ");
    const quantidade = rest[qtdIndex];
    const motivo = rest.slice(qtdIndex + 1).join(" ");

    if (!nome || !quantidade || !motivo) {
      return msg.reply(
        "❌ Uso correto: `!adicionar <id> <nome da solicitação> <quantidade> <motivo>`"
      );
    }

    const canalSolicitacoes = await client.channels.fetch(CANAL_SOLICITACOES).catch(() => null);
    if (!canalSolicitacoes?.isTextBased()) {
      return msg.reply("❌ Canal de solicitações não encontrado ou inválido.");
    }

    const embed = new EmbedBuilder()
      .setTitle(`📩 Nova Solicitação: ${nome}`)
      .addFields(
        { name: "ID", value: id, inline: true },
        { name: "Quantidade", value: quantidade, inline: true },
        { name: "Motivo", value: motivo }
      )
      .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
      .setColor("#FF004C")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("aprovar_solicitacao")
        .setLabel("✅ Aprovar")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("reprovar_solicitacao")
        .setLabel("❌ Reprovar")
        .setStyle(ButtonStyle.Danger)
    );

    await canalSolicitacoes.send({ embeds: [embed], components: [row] });

    await msg.reply("✅ Solicitação enviada para análise.");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // FORMULÁRIO
    if (interaction.isButton() && interaction.customId === "abrir_formulario") {
      const modal = new ModalBuilder()
        .setCustomId("formulario_entrada")
        .setTitle("👑 Junte-se à Imperial Group");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Seu nome ou apelido")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("idade")
            .setLabel("Sua idade")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("servidor")
            .setLabel("Servidor que você faz parte")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("motivo")
            .setLabel("Por que quer entrar para a Imperial Group?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "formulario_entrada") {
      const nome = interaction.fields.getTextInputValue("nome");
      const idade = interaction.fields.getTextInputValue("idade");
      const servidor = interaction.fields.getTextInputValue("servidor");
      const motivo = interaction.fields.getTextInputValue("motivo");

      const embed = new EmbedBuilder()
        .setTitle("📨 Novo Pedido de Entrada - Imperial Group")
        .addFields(
          { name: "👤 Nome", value: nome },
          { name: "🎂 Idade", value: idade },
          { name: "🌍 Servidor que você pertence a staff ", value: servidor },
          { name: "📝 Motivo", value: motivo }
        )
        .setFooter({ text: `ID: ${interaction.user.id}` })
        .setColor("DarkGold")
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aprovar_form")
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("reprovar_form")
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      const canalLogs = await client.channels.fetch(CANAL_LOGS);
      if (canalLogs?.isTextBased()) {
        await canalLogs.send({ embeds: [embed], components: [row] });
      }

      await interaction.reply({
        content: "✅ Formulário enviado com sucesso!",
        ephemeral: true,
      });
      return;
    }

    // APROVAR / REPROVAR FORMULÁRIO
    if (
      interaction.isButton() &&
      (interaction.customId === "aprovar_form" || interaction.customId === "reprovar_form")
    ) {
      const embed = interaction.message.embeds[0];
      const userId = embed?.footer?.text?.match(/\d+/)?.[0];
      if (!userId)
        return interaction.reply({
          content: "❌ Não foi possível identificar o usuário.",
          ephemeral: true,
        });

      const membro = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!membro)
        return interaction.reply({
          content: "❌ Membro não encontrado.",
          ephemeral: true,
        });

      if (!interaction.member.roles.cache.has(CARGO_APROVADOR)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para isso.",
          ephemeral: true,
        });
      }

      if (interaction.customId === "aprovar_form") {
        // Evitar criar canal duplicado
        const nomeFormatado = membro.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .slice(0, 20);

        const canalExistente = interaction.guild.channels.cache.find(
          (c) => c.name === `👑・${nomeFormatado}`
        );

        if (canalExistente) {
          return interaction.reply({
            content: `❌ Já existe um canal para este usuário: ${canalExistente}`,
            ephemeral: true,
          });
        }

        // Criar canal do aprovado
        const canalCriado = await interaction.guild.channels.create({
          name: `👑・${nomeFormatado}`,
          type: ChannelType.GuildText,
          parent: CATEGORIA_CANAIS,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: CARGO_STAFF,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            },
            {
              id: membro.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            },
            {
              id: client.user.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageChannels,
              ],
            },
          ],
        });

        // Adicionar cargo aprovado
        await membro.roles.add(CARGO_APROVADO);

        // Embed e botão para excluir canal
        const embedCanalAprovado = new EmbedBuilder()
          .setTitle("🎉 Parabéns, você foi aprovado!")
          .setDescription(`Olá ${membro}, seu pedido foi aprovado pela equipe da Imperial Group.`)
          .addFields(
            { name: "Aprovado por:", value: `${interaction.user}`, inline: true },
            { name: "Seu canal privado", value: canalCriado.toString(), inline: true }
          )
          .setColor("Green")
          .setTimestamp();

        const excluirRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("excluir_canal_aprovado")
            .setLabel("🗑️ Excluir canal")
            .setStyle(ButtonStyle.Danger)
        );

        await canalCriado.send({ embeds: [embedCanalAprovado], components: [excluirRow] });

        await interaction.reply({
          content: "✅ Usuário aprovado e canal criado!",
          ephemeral: true,
        });

        // Log no canal de logs
        const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(() => null);
        if (canalLogs?.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle("✅ Formulário aprovado")
            .setDescription(`Usuário ${membro} aprovado por ${interaction.user}`)
            .setColor("Green")
            .setTimestamp();
          canalLogs.send({ embeds: [logEmbed] });
        }
      }

      if (interaction.customId === "reprovar_form") {
        // Apenas adicionar cargo reprovado, sem criar canal
        await membro.roles.add(CARGO_REPROVADO);

        await interaction.reply({
          content: `❌ Usuário ${membro.user.tag} reprovado.`,
          ephemeral: true,
        });

        // Log no canal de logs
        const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(() => null);
        if (canalLogs?.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle("❌ Formulário reprovado")
            .setDescription(`Usuário ${membro} reprovado por ${interaction.user}`)
            .setColor("Red")
            .setTimestamp();
          canalLogs.send({ embeds: [logEmbed] });
        }
      }

      return;
    }

    // APROVAR / REPROVAR SOLICITAÇÃO via botão
    if (
      interaction.isButton() &&
      (interaction.customId === "aprovar_solicitacao" || interaction.customId === "reprovar_solicitacao")
    ) {
      if (!interaction.member.roles.cache.has(CARGO_APROVADOR)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para realizar essa ação.",
          ephemeral: true,
        });
      }

      const aprovado = interaction.customId === "aprovar_solicitacao";

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `Solicitação ${aprovado ? "APROVADA" : "REPROVADA"} por ${interaction.user.tag}` })
        .setColor(aprovado ? "Green" : "Red");

      await interaction.message.edit({ embeds: [embed], components: [] });

      await interaction.reply({
        content: `Você ${aprovado ? "aprovou" : "reprovou"} a solicitação.`,
        ephemeral: true,
      });
      return;
    }

    // ABRIR TICKET
    if (interaction.isButton() && interaction.customId === "abrir_ticket") {
      const guild = interaction.guild;
      const user = interaction.user;

      const ticketsAbertos = guild.channels.cache.filter(
        (c) => c.parentId === CATEGORIA_TICKETS && c.name === `ticket-min-${user.id}`
      );
      if (ticketsAbertos.size > 0) {
        return interaction.reply({
          content: `❌ Você já tem um ticket aberto: ${ticketsAbertos.first()}`,
          ephemeral: true,
        });
      }

      const canalTicket = await guild.channels.create({
        name: `ticket-min-${user.id}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_TICKETS,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: CARGO_STAFF,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket aberto")
        .setDescription(`Olá ${user}, a equipe da Imperial Group vai te ajudar aqui. Aguarde um momento!`)
        .setColor("Blue")
        .setTimestamp();

      await canalTicket.send({ content: `${user}`, embeds: [embed] });

      await interaction.reply({
        content: `✅ Ticket criado: ${canalTicket}`,
        ephemeral: true,
      });
    }

    // EXCLUIR CANAL APROVADO via botão
    if (interaction.isButton() && interaction.customId === "excluir_canal_aprovado") {
      const canal = interaction.channel;
      if (!canal.name.startsWith("👑・")) {
        return interaction.reply({
          content: "❌ Este comando só pode ser usado no canal aprovado.",
          ephemeral: true,
        });
      }
      await interaction.reply("🗑️ Canal será excluído em 5 segundos...");
      setTimeout(() => canal.delete().catch(() => {}), 5000);
    }
  } catch (err) {
    console.error("Erro no InteractionCreate:", err);
  }
});

client.login(TOKEN);
