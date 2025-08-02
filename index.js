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
const CARGO_APROVADO = process.env.CARGO_APROVADO;
const CARGO_REPROVADO = process.env.CARGO_REPROVADO;
const CARGO_STAFF = process.env.CARGO_STAFF;
const CATEGORIA_CANAIS = process.env.CATEGORIA_CANAIS;
const CATEGORIA_TICKETS = process.env.CATEGORIA_TICKETS;
const CARGO_AUTOROLE = process.env.CARGO_AUTOROLE;
const PORT = process.env.PORT || 3000;

const app = express();
app.get("/", (req, res) => res.send("Bot Imperial Group online."));
app.listen(PORT, () =>
  console.log(`🟢 Servidor HTTP ativo na porta ${PORT}.`)
);

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
      .setColor("Gold")
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
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
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
          { name: "🌍 Servidor de origem", value: servidor },
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

    if (
      interaction.isButton() &&
      (interaction.customId === "aprovar_form" || interaction.customId === "reprovar_form")
    ) {
      const embedOriginal = interaction.message.embeds[0];
      const userId = embedOriginal?.footer?.text?.match(/\d+/)?.[0];
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

      if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para isso.",
          ephemeral: true,
        });
      }

      const embedAtualizado = EmbedBuilder.from(embedOriginal).setColor(
        interaction.customId === "aprovar_form" ? "Green" : "Red"
      );

      if (interaction.customId === "aprovar_form") {
        const nomeFormatado = membro.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .slice(0, 20);

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

        await membro.roles.add(CARGO_APROVADO);

        await canalCriado.send(`🎉 Parabéns ${membro}, você foi aprovado para a Imperial Group!`);

        embedAtualizado.addFields({
          name: "✅ Aprovado por",
          value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
        });

        await interaction.message.edit({ embeds: [embedAtualizado], components: [] });

        return interaction.reply({
          content: "✅ Usuário aprovado e canal criado!",
          ephemeral: true,
        });
      }

      if (interaction.customId === "reprovar_form") {
        await membro.roles.add(CARGO_REPROVADO);

        embedAtualizado.addFields({
          name: "❌ Reprovado por",
          value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
        });

        await interaction.message.edit({ embeds: [embedAtualizado], components: [] });

        return interaction.reply({
          content: "❌ Usuário reprovado. Cargo atribuído.",
          ephemeral: true,
        });
      }
    }

    if (interaction.isButton() && interaction.customId === "abrir_ticket") {
      const guild = interaction.guild;
      const user = interaction.user;

      const ticketsAbertos = guild.channels.cache.filter(
        (c) => c.parentId === CATEGORIA_TICKETS && c.name === `ticket-min-${user.id}`
      );
      if (ticketsAbertos.size > 0) {
        return interaction.reply({
          content: "Você já possui um ticket aberto!",
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
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
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
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      const fecharRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fechar_ticket")
          .setLabel("🔒 Fechar Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await canalTicket.send({
        content: `Olá ${user}, seu ticket foi criado! Aguarde que a equipe irá te atender.`,
        components: [fecharRow],
      });

      await interaction.reply({
        content: `✅ Seu ticket foi criado: ${canalTicket}`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "fechar_ticket") {
      const channel = interaction.channel;

      if (channel.parentId !== CATEGORIA_TICKETS) {
        return interaction.reply({
          content: "❌ Este canal não é um ticket.",
          ephemeral: true,
        });
      }

      const ticketOwnerId = channel.name.split("ticket-min-")[1];
      if (
        !interaction.member.roles.cache.has(CARGO_STAFF) &&
        interaction.user.id !== ticketOwnerId
      ) {
        return interaction.reply({
          content: "❌ Você não tem permissão para fechar este ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "🔒 Ticket será fechado em 5 segundos.",
        ephemeral: true,
      });

      setTimeout(async () => {
        await channel.delete().catch(() => null);
      }, 5000);
    }
  } catch (error) {
    console.error("Erro na interação:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Ocorreu um erro interno.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "❌ Ocorreu um erro interno.",
        ephemeral: true,
      });
    }
  }
});

client.login(TOKEN);
