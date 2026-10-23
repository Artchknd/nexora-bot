export const MESSAGE_COMMAND_NAME = "Ask Nexora";

// 0 = 伺服器安裝, 1 = 使用者安裝
const integration_types = [0, 1];
// 0 = 伺服器, 1 = Bot 私訊, 2 = 私訊與群組私訊
const contexts = [0, 1, 2];

export const commands = [
  {
    name: "ask",
    type: 1,
    description: "向 AI 提問",
    integration_types,
    contexts,
    options: [
      {
        name: "question",
        type: 3,
        description: "你的問題",
        required: true,
        max_length: 2000,
      },
      {
        name: "style",
        type: 3,
        description: "這次的回答風格（會覆蓋預設風格）",
        required: false,
        max_length: 200,
      },
      {
        name: "model",
        type: 3,
        description: "這次使用的模型（會覆蓋預設模型）",
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: "model",
    type: 1,
    description: "管理預設模型",
    integration_types,
    contexts,
    options: [
      {
        name: "set",
        type: 1,
        description: "設定預設模型",
        options: [
          {
            name: "model",
            type: 3,
            description: "從清單選擇模型",
            required: true,
            autocomplete: true,
          },
        ],
      },
      { name: "show", type: 1, description: "顯示目前使用的模型" },
      { name: "clear", type: 1, description: "改回系統預設模型" },
    ],
  },
  {
    name: "style",
    type: 1,
    description: "管理預設回答風格",
    integration_types,
    contexts,
    options: [
      {
        name: "set",
        type: 1,
        description: "設定預設回答風格",
        options: [
          {
            name: "text",
            type: 3,
            description: "例如：簡短口語、像學長一樣直接",
            required: true,
            max_length: 300,
          },
        ],
      },
      { name: "clear", type: 1, description: "清除預設回答風格" },
    ],
  },
  {
    name: "reset",
    type: 1,
    description: "清除這個頻道的對話記憶",
    integration_types,
    contexts,
  },
  {
    name: MESSAGE_COMMAND_NAME,
    type: 3,
    integration_types,
    contexts,
  },
];
