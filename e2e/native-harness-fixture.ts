// Native protocol fixture only. Never resolves an installed provider or reads its auth HOME.
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';

export async function startNativeHarnessFixture(info: TestInfo) {
  const bridge = path.resolve('bridge/target/debug/moro-ai-bridge');
  const fixture = path.resolve('bridge/target/debug/fake-harness-cli-fixture');
  await Promise.all([access(bridge, constants.X_OK), access(fixture, constants.X_OK)]);
  const home = info.outputPath('isolated-provider-home');
  const tmp = info.outputPath('isolated-provider-tmp');
  await Promise.all([mkdir(home, { recursive: true }), mkdir(tmp, { recursive: true })]);
  const port = await new Promise<number>((resolve, reject) => {
    const reservation = createServer();
    reservation.on('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
      const address = reservation.address();
      if (!address || typeof address === 'string') { reservation.close(); reject(Error('No loopback fixture port.')); return; }
      reservation.close(error => error ? reject(error) : resolve(address.port));
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(bridge, ['--web-root', path.resolve('dist'), '--port', String(port), '--codex-bin', fixture, '--claude-bin', fixture], {
    cwd: path.resolve('.'), env: { PATH: '', HOME: home, TMPDIR: tmp }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stderr?.on('data', value => { diagnostic = (diagnostic + String(value)).slice(-16_384); });
  let spawnError: Error | undefined;
  child.once('error', error => { spawnError = error; });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise<void>(resolve => child.once('exit', () => resolve())),
        new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(Error('Fixture bridge cleanup pending; no force kill.')), 7000); timer.unref(); }),
      ]);
    }
    await writeFile(info.outputPath('native-fixture-receipt.json'), JSON.stringify({
      evidenceKind: 'explicit-fake-protocol-not-inference', origin, pid: child.pid,
      isolatedHome: true, providerPathEmpty: true, bridgeExitCode: child.exitCode,
      bridgeSignal: child.signalCode, stderr: diagnostic,
    }, null, 2));
  };
  try {
    let ready = false;
    for (let tries = 0; tries < 60; tries++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error(`Fixture bridge exited (${child.exitCode}): ${diagnostic}`);
      try { ready = (await fetch(`${origin}/api/ai/status`, { signal: AbortSignal.timeout(500) })).ok; } catch { /* bounded readiness retry */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw Error('Native fixture readiness timed out.');
    return { origin, stop };
  } catch (error) { await stop(); throw error; }
}
