import { Intent, Script, Widget } from "scripting"
import { parseCommandParameter } from "./utils/command"
import { runCommand } from "./common/model"

async function main() {
  const input = parseCommandParameter(Intent.shortcutParameter)
  const result = await runCommand(input.command, input.event_ts, input.source, {
    backup_file_path: input.backup_file_path,
    backup_json: input.backup_json,
  })
  Widget.reloadAll()
  const finalResult = input.warning && !result.warning
    ? { ...result, warning: input.warning, message: `${input.warning}\n${result.message}` }
    : result
  Script.exit(Intent.json(finalResult))
}

main()
