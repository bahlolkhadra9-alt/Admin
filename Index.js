const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const REVIEW_ROLE_ID = process.env.REVIEW_ROLE_ID || "";

client.once("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  if (message.content !== "!setupapply") return;

  if (!message.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  )) return message.reply("هذا الأمر للإدارة فقط.");

  const embed = new EmbedBuilder()
    .setTitle("📋 التقديم على الفريق الإداري")
    .setDescription(
      "اضغط على الزر أدناه واملأ نموذج التقديم.\n" +
      "ستصل إجاباتك إلى الإدارة للمراجعة."
    )
    .setColor(0x5865F2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("apply_admin")
      .setLabel("📋 تقديم للإدارة")
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.reply("تم نشر بوست التقديم.");
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isButton() &&
        interaction.customId === "apply_admin") {

      const modal = new ModalBuilder()
        .setCustomId("admin_form")
        .setTitle("التقديم للإدارة");

      const questions = [
        ["age", "كم عمرك؟", TextInputStyle.Short],
        ["experience", "هل لديك خبرة إدارية؟", TextInputStyle.Paragraph],
        ["activity", "كم ساعة تتواجد يومياً؟", TextInputStyle.Short],
        ["reason", "لماذا تريد الانضمام؟", TextInputStyle.Paragraph],
        ["rules", "كيف تتعامل مع مخالفات الأعضاء؟", TextInputStyle.Paragraph]
      ];

      for (const [id, label, style] of questions) {
        const input = new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setStyle(style)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );
      }

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() &&
        interaction.customId === "admin_form") {

      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guildId) {
        return interaction.editReply("استخدم النموذج داخل السيرفر.");
      }

      const channel = await client.channels.fetch(REVIEW_CHANNEL_ID);

      if (!channel || !channel.isTextBased() ||
          channel.guildId !== interaction.guildId) {
        return interaction.editReply("روم مراجعة الطلبات غير مضبوط.");
      }

      const embed = new EmbedBuilder()
        .setTitle("📨 طلب تقديم إداري جديد")
        .setDescription(
          `المتقدم: ${interaction.user}\n` +
          `ID: ${interaction.user.id}`
        )
        .setColor(0xF1C40F);

      const questions = [
        ["age", "العمر"],
        ["experience", "الخبرة"],
        ["activity", "التواجد اليومي"],
        ["reason", "سبب التقديم"],
        ["rules", "التعامل مع المخالفات"]
      ];

      for (const [id, label] of questions) {
        embed.addFields({
          name: label,
          value: interaction.fields.getTextInputValue(id).slice(0, 1024)
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_${interaction.user.id}`)
          .setLabel("قبول")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${interaction.user.id}`)
          .setLabel("رفض")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply("✅ وصل طلبك إلى الإدارة.");
    }

    if (interaction.isButton() &&
        /^(accept|reject)_\d+$/.test(interaction.customId)) {

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      const allowed = member.permissions.has(
        PermissionsBitField.Flags.Administrator
      ) || (REVIEW_ROLE_ID &&
        member.roles.cache.has(REVIEW_ROLE_ID));

      if (!allowed) {
        return interaction.reply({
          content: "ليس لديك صلاحية مراجعة الطلبات.",
          ephemeral: true
        });
      }

      const [decision, applicantId] = interaction.customId.split("_");
      const accepted = decision === "accept";

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(accepted ? 0x2ECC71 : 0xE74C3C)
        .addFields({
          name: "نتيجة الطلب",
          value: `${accepted ? "✅ مقبول" : "❌ مرفوض"} بواسطة ${interaction.user}`
        });

      await interaction.update({ embeds: [embed], components: [] });

      try {
        const applicant = await client.users.fetch(applicantId);
        await applicant.send(
          accepted
            ? "🎉 تم قبول طلبك للانضمام إلى الفريق الإداري."
            : "تم رفض طلبك الإداري هذه المرة. شكرًا لتقديمك."
        );
      } catch {}
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() &&
        !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "حدث خطأ. تحقق من إعدادات البوت.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

if (!TOKEN || !REVIEW_CHANNEL_ID) {
  throw new Error("أضف DISCORD_TOKEN و REVIEW_CHANNEL_ID في إعدادات الاستضافة.");
}

client.login(TOKEN);
