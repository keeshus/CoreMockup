export class MCPManager {
  constructor() {
    this.clients = new Map();
    this.tools = new Map();
  }

  async connectAll(servers = []) {
    await this.disconnectAll();
    for (const server of servers) {
      if (!server.name || !server.url) continue;
      try {
        await this.connect(server);
      } catch (err) {
        console.error(`Failed to connect MCP server "${server.name}":`, err.message);
      }
    }
  }

  async connect(serverConfig) {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const transportType = serverConfig.transport || 'sse';
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
    const transport = new SSEClientTransport(new URL(serverConfig.url));

    const client = new Client({ name: 'core-mockup', version: '1.0.0' });
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const toolEntries = (toolsResult.tools || []).map(t => [t.name, {
      ...t,
      _client: client,
      _serverName: serverConfig.name,
    }]);

    for (const [name, tool] of toolEntries) {
      this.tools.set(name, tool);
    }

    this.clients.set(serverConfig.name, client);

    return {
      name: serverConfig.name,
      transport: transportType,
      tools: toolEntries.map(([name]) => name),
    };
  }

  async disconnectAll() {
    this.tools.clear();
    for (const [name, client] of this.clients) {
      try { await client.close(); } catch {}
    }
    this.clients.clear();
  }

  async callTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`MCP tool not found: ${toolName}`);
    const result = await tool._client.callTool({
      name: toolName,
      arguments: args,
    });
    const raw = result.content ?? result;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      return raw.map(c => c.text || JSON.stringify(c)).filter(Boolean).join('\n');
    }
    return JSON.stringify(raw);
  }

  getToolDefs() {
    const defs = [];
    for (const [name, tool] of this.tools) {
      defs.push({
        name,
        description: tool.description || `MCP tool from ${tool._serverName}`,
        inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      });
    }
    return defs;
  }

  getStatus() {
    const status = {};
    for (const [name, client] of this.clients) {
      status[name] = 'connected';
    }
    return status;
  }
}
