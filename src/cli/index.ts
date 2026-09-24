import { runSearchCommand } from "./search";
import { runListCommand } from "./list";
import { runDoctorCommand } from "./doctor";

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (match) flags[match[1]] = match[2];
  }
  return flags;
}

async function main(): Promise<number> {
  const command = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  switch (command) {
    case "search":
      return runSearchCommand(flags);
    case "list":
      return runListCommand(flags);
    case "doctor":
      return runDoctorCommand();
    default:
      console.log(`Usage:
  npm run search -- --platform=linkedin
  npm run search -- --platform=x --city=istanbul --keyword=startup --days=14
  npm run search -- --hashtag=hackathon
  npm run events -- --city=eskisehir
  npm run doctor

Note: --platform=twitter is accepted as an alias for x.`);
      return command ? 1 : 0;
  }
}

main().then((code) => process.exit(code));
