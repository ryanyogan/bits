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
minutes: 8
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

An MCP tool and an Anthropic tool are the same idea: a name, a description
and a JSON Schema for the input. Only the spelling differs. Your turn: copy
the `tracker_search_issues` tool from `tools-list.json` above and get Claude
to turn it into an Anthropic tool definition.

:::prompt{id="mcp-to-claude" xp=20 coach}
Turn the MCP tool listing into an Anthropic tool definition
- goal "Get Claude to rewrite the MCP tool as one Anthropic tool definition, as JSON only, with nothing lost or added"
- placeholder "Here's a tool from an MCP server's tools/list: {…} Rewrite it as an Anthropic Messages API tool definition. JSON only."
- draft "Convert my MCP tool for Claude."
- check "Pastes the tool" /tracker_search_issues/
- check "Pastes the tool" /inputSchema/
- check "Pastes the tool" /query/
- check "Says the target format" /anthropic|input_schema|messages api|claude.s tool/i
- expect "Has the three fields" json keys=name,description,input_schema
- expect "Keeps the name" match /tracker_search_issues/
- rubric "Keeps the description and the schema's properties and required list the same, only renaming inputSchema to input_schema" must evidence
- rubric "Returns one tool definition, not the whole tools list" should
- hint "Is the tool itself in your prompt, or only its name?"
- hint "Say which format you want back. The field Claude's API reads is input_schema."
- hint "Paste the tool, then ask: rewrite this as one Anthropic tool definition, with input_schema, as JSON only, and change nothing else."
- reference "Here's a tool from an MCP server's tools/list:\n{\n  \"name\": \"tracker_search_issues\",\n  \"description\": \"Search open issues by keyword. Use it when the user asks about a bug, a ticket or what's being worked on. Returns at most 20 issues with id, title and status.\",\n  \"inputSchema\": { \"type\": \"object\", \"properties\": { \"query\": { \"type\": \"string\", \"description\": \"Words to search for\" } }, \"required\": [\"query\"] }\n}\n\nRewrite it as one tool definition for the Anthropic Messages API (name, description, input_schema). Change nothing else. Reply with the JSON object only."
- run temperature=[1.0]
- example T=1.0 "{\n  \"name\": \"tracker_search_issues\",\n  \"description\": \"Search open issues by keyword. Use it when the user asks about a bug, a ticket or what's being worked on. Returns at most 20 issues with id, title and status.\",\n  \"input_schema\": { \"type\": \"object\", \"properties\": { \"query\": { \"type\": \"string\", \"description\": \"Words to search for\" } }, \"required\": [\"query\"] }\n}"
- success "Same name, same description, same schema: write it once, use it in both." next="Next: a weather bot →"
:::

:::rabbithole
- read "What is the Model Context Protocol?" by="MCP" url="https://modelcontextprotocol.io/docs/getting-started/intro"
- read "MCP architecture overview" by="MCP" url="https://modelcontextprotocol.io/docs/learn/architecture"
- read "MCP connector" by="Anthropic" url="https://platform.claude.com/docs/en/agents-and-tools/mcp-connector"
:::
