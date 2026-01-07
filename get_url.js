// 1. 你的原始数据（按顺序放入数组）
const rawData = [
    "WLDS",                                                                 // 0: 代码
    "906.36万",                                                             // 1: 成交量
    "34.76万",                                                              // 2: 换手/流通
    "$1.43",                                                                // 3: 价格
    "Wearable Devices Ltd. 与 Rokid 合作，将神经手势控制引入人工智能和增强现实眼镜", // 4: 标题
    "与估值10亿美元的AR独角兽Rokid合作，有望在2026年推出消费级捆绑产品。",          // 5: 逻辑
    "产品2026年才推出，存在执行风险。"                                            // 6: 风险
];

// 2. 使用特殊分隔符拼接 (比如 "|||")
const joinedString = rawData.join('|||');

// 3. 转为 Buffer 并进行 Base64 编码
let base64Str = Buffer.from(joinedString, 'utf-8').toString('base64');

// 4. 【关键步骤】转换为 Telegram 允许的 URL Safe 格式
// + 变 -
// / 变 _
// 去掉末尾的 =
const safePayload = base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

console.log("生成的参数长度:", safePayload.length);
console.log("最终链接:", `https://t.me/news_alert_0808_bot/news_alert_app?startapp=${safePayload}`);

// 5. 发送消息
/*
bot.sendMessage(chatId, '...', {
    reply_markup: {
        inline_keyboard: [[
            { text: "查看详情", url: `https://t.me/news_alert_0808_bot/news_alert_app?startapp=${safePayload}` }
        ]]
    }
});
*/