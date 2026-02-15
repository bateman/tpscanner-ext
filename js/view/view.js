function getBrowser() {
  return self.browser || self.chrome;
}

export class View {
  update(action, data) {
    getBrowser().runtime
      .sendMessage({
        type: "RESPONSE_" + action,
        data: data,
      })
      .catch(() => {
        // Popup may be closed; ignore send errors
      });
  }
}
