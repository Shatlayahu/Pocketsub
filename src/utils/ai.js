const responses = {
  explain_sentence:
    '这句话可以先看整体语气，再处理具体词组。它通常不适合逐词直译，建议翻成自然的中文表达。',
  suggest_translation:
    '参考译文：我说不上来哪里不对。',
  polish_translation:
    '润色建议：让译文更口语、更短一些，避免保留英文句式。',
}

export async function askAI(payload) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 450)
  })

  return {
    answer: responses[payload.mode] || responses.explain_sentence,
    suggestedTranslation:
      payload.mode === 'polish_translation'
        ? payload.userTranslation?.trim() || '我说不上来哪里不对。'
        : '我说不上来哪里不对。',
  }
}
