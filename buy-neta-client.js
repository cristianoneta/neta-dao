class NetaCosmosClient {
  constructor(endpoints, {timeoutMs = 8000, hedgeDelayMs = 350} = {}) {
    this.endpoints = [...new Set(endpoints.map(endpoint => endpoint.replace(/\/$/, "")))];
    this.timeoutMs = timeoutMs;
    this.hedgeDelayMs = hedgeDelayMs;
    this.preferredEndpoint = null;
    if (!this.endpoints.length) throw new Error("At least one LCD endpoint is required");
  }

  orderedEndpoints() {
    if (!this.preferredEndpoint) return this.endpoints;
    return [
      this.preferredEndpoint,
      ...this.endpoints.filter(endpoint => endpoint !== this.preferredEndpoint),
    ];
  }

  async get(path) {
    if (typeof path !== "string" || !path.startsWith("/")) throw new Error("INVALID LCD PATH");
    const controllers = [];
    const errors = [];
    let completed = false;
    const attempts = this.orderedEndpoints().map(async (endpoint, index) => {
      if (index) await new Promise(resolve => setTimeout(resolve, this.hedgeDelayMs * index));
      if (completed) throw new Error("REQUEST ALREADY COMPLETED");
      const controller = new AbortController();
      controllers.push(controller);
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(endpoint + path, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || typeof data !== "object") throw new Error("INVALID JSON RESPONSE");
        return {data, endpoint};
      } catch (error) {
        if (error.message !== "REQUEST ALREADY COMPLETED") {
          errors.push(error.name === "AbortError" ? `${this.timeoutMs}MS TIMEOUT` : String(error.message || "REQUEST FAILED"));
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    });
    try {
      const winner = await Promise.any(attempts);
      completed = true;
      this.preferredEndpoint = winner.endpoint;
      controllers.forEach(controller => controller.abort());
      return winner;
    } catch (_) {
      completed = true;
      throw new Error(`ALL JUNO LCD ENDPOINTS FAILED // ${errors.join(" // ")}`);
    }
  }

  async smart(contract, message) {
    if (!/^juno1[0-9a-z]{38,63}$/.test(contract)) throw new Error("INVALID JUNO CONTRACT");
    const bytes = new TextEncoder().encode(JSON.stringify(message));
    const raw = btoa(String.fromCharCode(...bytes));
    const {data} = await this.get(
      `/cosmwasm/wasm/v1/contract/${contract}/smart/${encodeURIComponent(raw)}`,
    );
    return data.data ?? data;
  }

  async contractInfo(contract) {
    if (!/^juno1[0-9a-z]{38,63}$/.test(contract)) throw new Error("INVALID JUNO CONTRACT");
    const {data} = await this.get(`/cosmwasm/wasm/v1/contract/${contract}`);
    return data.contract_info ?? data;
  }
}

window.NetaCosmosClient = NetaCosmosClient;
