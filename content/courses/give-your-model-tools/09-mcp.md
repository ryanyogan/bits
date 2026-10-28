---
# sources (checked 2026-10-27):
# - Model Context Protocol, What is MCP? (open-source standard for connecting AI applications to
#   external systems; the USB-C comparison is theirs; supported by Claude, ChatGPT, VS Code, Cursor)
#   https://modelcontextprotocol.io/docs/getting-started/intro
# - Model Context Protocol, Architecture overview (host, client, server; servers expose tools,
#   resources and prompts; tools/list returns name, description and inputSchema (JSON Schema);
#   tools/call runs one; stdio for local servers, Streamable HTTP for remote ones)
#   https://modelcontextprotocol.io/docs/learn/architecture
# - Anthropic, MCP connector (beta mcp-client-2025-11-20; mcp_servers + an mcp_toolset entry;
#   remote HTTP servers only, no local stdio; only tool calls are supported)
#   https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
# - Anthropic Engineering, Writing effective tools for agents (claude mcp add <name> <command>;
#   MCP tool annotations flag destructive or open-world tools)
#   https://www.anthropic.com/engineering/writing-tools-for-agents
title: "MCP: tools you can share"
order: 9
minutes: 7
xp: 40
module: Real-world calls
---

You've been writing tools for **your** app. Now imagine you've built a great
set for your company's issue tracker, and you want them in Claude Code, in
Claude Desktop, in your teammate's editor and in your own agent. Rewriting
them for each one gets old fast.

The **Model Context Protocol (MCP)** is the open standard for this. You
package tools once as an **MCP server**, and any app that speaks MCP can
use them. The MCP site compares it to a USB-C port: one plug shape, lots of
devices. Claude, ChatGPT, VS Code and Cursor all support it.

Three roles, in MCP's words. The **host** is the AI app (Claude Code, say).
It opens a **client** connection to each **server** it uses. A server can
offer **tools** (actions), **resources** (data to read) and **prompts**
(reusable templates). Tools are the part you already know.

:::code{file="tools-list.json" lang="json"}
{
  "tools": [
    {
      "name": "tracker_search_issues",
      "description": "Search open issues by keyword. Use it when the user asks about a bug, a ticket or what's being worked on. Returns at most 20 issues with id, title and status.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Words to search for" }
        },
        "required": ["query"]
      }
    }
  ]
}
:::

:::code{file="connector.ts" lang="ts" copy}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Beta, as of October 2026: Claude connects to a remote MCP server for you.
const reply = await client.beta.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  mcp_servers: [{ type: "url", url: "https://mcp.example.com/mcp", name: "tracker" }],
  tools: [{ type: "mcp_toolset", mcp_server_name: "tracker" }],
  messages: [{ role: "user", content: "Any open bugs about login?" }],
});
:::

Look at the first tab. That's what an MCP server answers when a client asks
for its tools (a `tools/list` request, trimmed here). It's the same three
parts you've written all course: a **name**, a **description** and a JSON
Schema for the input, spelled `inputSchema`. Everything you learned about
descriptions applies here too. An MCP server with vague descriptions is
just as confusing, in every app at once.

---

How you plug one in depends on the host. In **Claude Code**, it's one
command: `claude mcp add <name> <command>`. Local servers run on your
machine and talk over standard input and output (**stdio**). Remote servers
run on the web and talk over **Streamable HTTP**.

From your own code, you have two options. The **MCP connector** (second tab)
lets the Messages API connect to a remote server for you. It's a beta, it
only does tools, and it can't reach local stdio servers. Or you use an **MCP
client library** in your app, list the server's tools, and pass them to
Claude as ordinary client tools: the same round trip you already know.

One caution. An MCP server is code someone else wrote, and its tool results
are text someone else controls. Install servers from sources you trust, and
take extra care with tools that write, delete or spend money.

:::quiz{id="mcp-what" xp=20}
What does MCP standardise?

- [ ] How a model is trained to use tools
  Not quite. MCP doesn't touch the model. It's about how apps and tool providers connect.
- [x] How AI apps find and call tools (and data) that someone else provides
  Right. Write a server once, and any MCP host can list and call its tools.
- [ ] A new kind of tool that only Claude can use
  Not quite. It's an open standard, and many AI apps support it.
:::

:::quiz{id="mcp-shape" xp=20}
An MCP server lists a tool with a name, a description and an inputSchema. How does that compare to an Anthropic tool definition?

- [x] It's the same idea: name, description, and a JSON Schema for the input
  Right. Only the spelling differs (inputSchema vs input_schema), so the same writing advice applies.
- [ ] MCP tools don't need descriptions
  Not quite. The model still has to pick the tool from its description.
- [ ] MCP tools run inside the model
  Not quite. They run in the server. The model only asks for a call.
:::

:::rabbithole
- read "What is the Model Context Protocol?" by="MCP" url="https://modelcontextprotocol.io/docs/getting-started/intro"
- read "MCP architecture overview" by="MCP" url="https://modelcontextprotocol.io/docs/learn/architecture"
- read "MCP connector" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/mcp-connector"
:::
