import { Intent, Script, Widget } from "scripting"
import { parseCommandParameter } from "./utils"
import { runCommand } from "./model"

async function main() {
  const input = parseCommandParameter(Intent.shortcutParameter)
  const result = await runCommand(input.command, input.event_ts, input.source)
  Widget.reloadAll()
  const finalResult = input.warning && !result.warning
    ? { ...result, warning: input.warning, message: `${input.warning}\n${result.message}` }
    : result
  Script.exit(Intent.json(finalResult))
}

main()
