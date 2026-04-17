/**
 * Standard Commander entry: parse argv and map failures to a non-zero exit code
 * without throwing past the process boundary.
 */
export async function runCommanderMain(
  parseAsync: (argv: string[]) => Promise<unknown>,
): Promise<void> {
  try {
    await parseAsync(process.argv);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
