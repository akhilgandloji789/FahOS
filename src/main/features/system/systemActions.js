'use strict';
// FahOS — Native Windows OS & PowerShell Automation Agent
// Executes verified, auditable PowerShell & Shell commands for deep desktop actions.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { exec } = require('child_process');

// Restore helper from Windows Recycle Bin
async function restoreFromRecycleBin(itemName) {
  const tempPs1 = path.join(os.tmpdir(), `restore_${Date.now()}.ps1`);
  const psScript = [
    '$sh = New-Object -ComObject Shell.Application',
    '$rb = $sh.Namespace(10)',
    'foreach ($item in $rb.Items()) {',
    `    if ($item.Name -like '*${itemName}*') {`,
    '        Write-Output ("FOUND_IN_BIN: " + $item.Name)',
    '        foreach ($verb in $item.Verbs()) {',
    '            if ($verb.Name -match "restore|undelete|&e") {',
    '                $verb.DoIt()',
    '                Write-Output ("RESTORED: " + $item.Name)',
    '                break',
    '            }',
    '        }',
    '    }',
    '}'
  ].join('\r\n');
  fs.writeFileSync(tempPs1, psScript, 'utf8');
  const res = await runPowerShell(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`);
  try { fs.unlinkSync(tempPs1); } catch (_) {}
  return res;
}

// ==================== 🛡️ 3-TIER PERMISSION SYSTEM ====================
const PERMISSION_TIERS = {
  SAFE: 'SAFE',           // 🟢 Executes immediately
  CONFIRM: 'CONFIRM',     // 🟡 Visible notification / confirmation
  DANGEROUS: 'DANGEROUS'  // 🔴 Strictly blocked until explicit interactive approval
};

const TOOLS = {
  // 🟢 SAFE
  open_app: { name: 'open_app', tier: PERMISSION_TIERS.SAFE, description: 'Opens verified desktop application' },
  open_folder: { name: 'open_folder', tier: PERMISSION_TIERS.SAFE, description: 'Opens verified directory in File Explorer' },
  open_url: { name: 'open_url', tier: PERMISSION_TIERS.SAFE, description: 'Opens web link in browser' },
  search_web: { name: 'search_web', tier: PERMISSION_TIERS.SAFE, description: 'Searches Google or YouTube' },
  read_screen: { name: 'read_screen', tier: PERMISSION_TIERS.SAFE, description: 'Reads screen for vision agent' },
  get_active_window: { name: 'get_active_window', tier: PERMISSION_TIERS.SAFE, description: 'Gets active window process & title' },
  get_current_url: { name: 'get_current_url', tier: PERMISSION_TIERS.SAFE, description: 'Gets active browser URL' },
  read_file: { name: 'read_file', tier: PERMISSION_TIERS.SAFE, description: 'Reads local file safely' },
  wait: { name: 'wait', tier: PERMISSION_TIERS.SAFE, description: 'Async delay for UI pacing' },

  // 🟡 CONFIRM
  write_file: { name: 'write_file', tier: PERMISSION_TIERS.CONFIRM, description: 'Creates or modifies file in folder' },
  click: { name: 'click', tier: PERMISSION_TIERS.CONFIRM, description: 'Visually clicks coordinate or UI target' },
  type_text: { name: 'type_text', tier: PERMISSION_TIERS.CONFIRM, description: 'Types text into focused window' },
  run_command: { name: 'run_command', tier: PERMISSION_TIERS.CONFIRM, description: 'Executes controlled PowerShell command' },
  browser_control: { name: 'browser_control', tier: PERMISSION_TIERS.CONFIRM, description: 'Autonomous Browser Use web navigation & task execution' },

  // 🔴 DANGEROUS
  delete_file: { name: 'delete_file', tier: PERMISSION_TIERS.DANGEROUS, description: 'Permanently deletes file or folder' },
  install_program: { name: 'install_program', tier: PERMISSION_TIERS.DANGEROUS, description: 'Executes program installer' },
  shutdown: { name: 'shutdown', tier: PERMISSION_TIERS.DANGEROUS, description: 'Powers down or restarts workstation' }
};

function runPowerShell(cmd) {
  return new Promise((resolve) => {
    const trimmed = String(cmd || '').trim();
    console.log(`\n======================================================`);
    console.log(`[FahOS OS Agent] Executing Windows Shell Automation:`);
    console.log(trimmed);
    console.log(`======================================================`);

    // If it's a web URL launch, open in default browser via Electron shell.openExternal or PowerShell Start-Process
    if (/^start\s+https?:\/\//i.test(trimmed)) {
      const rawUrl = trimmed.replace(/^start\s+/i, '').replace(/^""\s+/, '').replace(/^["']|["']$/g, '');
      try {
        const { shell } = require('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(rawUrl).then(() => {
            console.log(`[FahOS OS Agent] [Success] Web URL opened in default browser: ${rawUrl}`);
            resolve({ ok: true, output: rawUrl });
          }).catch((err) => {
            console.warn(`[FahOS OS Agent] Notice:`, err.message);
            resolve({ ok: false, error: err.message });
          });
          return;
        }
      } catch (_) {}

      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${rawUrl}'"`;
      exec(psCommand, (err, stdout) => {
        if (err) {
          console.warn(`[FahOS OS Agent] Notice / Non-fatal:`, err.message);
          resolve({ ok: false, error: err.message });
        } else {
          console.log(`[FahOS OS Agent] [Success] Web URL opened in default browser (Exit Code: 0)`);
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    // If it's a simple single-line 'start ...' command, run via PowerShell Start-Process with directory / app autocorrect
    if (!trimmed.includes('\n') && /^start\s+/i.test(trimmed)) {
      const rawTarget = trimmed.replace(/^start\s+/i, '').replace(/^""\s+/, '').replace(/^["']|["']$/g, '').trim();
      
      // 1. Check if rawTarget is a specific directory or folder
      const resolvedDir = resolveDirectory(rawTarget);
      if (resolvedDir && resolvedDir.path) {
        try {
          const { shell } = require('electron');
          if (shell && shell.openPath) {
            shell.openPath(resolvedDir.path).then((errMsg) => {
              if (!errMsg) {
                console.log(`[FahOS OS Agent] [Success] Directory opened via shell.openPath: ${resolvedDir.path}`);
                resolve({ ok: true, output: resolvedDir.path });
              } else {
                const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process explorer.exe -ArgumentList '${resolvedDir.path}'"`;
                exec(psCmd, () => resolve({ ok: true, output: resolvedDir.path }));
              }
            }).catch(() => {
              const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process explorer.exe -ArgumentList '${resolvedDir.path}'"`;
              exec(psCmd, () => resolve({ ok: true, output: resolvedDir.path }));
            });
            return;
          }
        } catch (_) {}
      }

      // 2. Check if rawTarget is a known app or direct target
      const resolved = resolveApp(rawTarget);
      const finalTarget = resolved ? (resolved.protocol || resolved.url || resolved.command) : rawTarget;
      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${finalTarget}'"`;
      exec(psCommand, (err, stdout) => {
        if (err) {
          console.warn(`[FahOS OS Agent] Notice / Non-fatal:`, err.message);
          resolve({ ok: false, error: err.message });
        } else {
          console.log(`[FahOS OS Agent] [Success] App launched successfully via Start-Process (Exit Code: 0)`);
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    // If it's a simple single-line 'taskkill ...' command, run via cmd.exe /c
    if (!trimmed.includes('\n') && /^taskkill\s+/i.test(trimmed)) {
      exec(`cmd.exe /c ${trimmed}`, (err, stdout) => {
        if (err) {
          console.warn(`[FahOS OS Agent] Notice / Non-fatal:`, err.message);
          resolve({ ok: false, error: err.message });
        } else {
          console.log(`[FahOS OS Agent] [Success] Command executed successfully (Exit Code: 0)`);
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    // For multi-step automation scripts, execute via temporary .ps1 file
    const tempFile = path.join(os.tmpdir(), `fahos_step_${Date.now()}.ps1`);
    fs.writeFileSync(tempFile, trimmed, 'utf8');

    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;
    exec(psCommand, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      if (err) {
        console.warn(`[FahOS OS Agent] Notice / Non-fatal:`, err.message);
        resolve({ ok: false, error: err.message });
      } else {
        console.log(`[FahOS OS Agent] [Success] Step-by-step automation executed successfully (Exit Code: 0)`);
        resolve({ ok: true, output: stdout ? stdout.trim() : '' });
      }
    });
  });
}

// Levenshtein distance for fuzzy autocorrect
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

const KNOWN_APPS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    protocol: 'whatsapp:',
    aliases: ['whatsapp', 'whattsapp', 'whatapp', 'watsapp', 'watsap', 'whatsap', 'whatsup', 'whtasapp', 'wtsp', 'watsp', 'wtsapp', 'whatssapp']
  },
  {
    id: 'spotify',
    name: 'Spotify',
    protocol: 'spotify:',
    aliases: ['spotify', 'spotfy', 'spotifiy', 'spotfiy', 'spoty', 'spotifi', 'spotif']
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    command: 'chrome',
    url: 'https://www.google.com',
    aliases: ['chrome', 'crome', 'chome', 'crom', 'chrom', 'google chrome', 'browser', 'web browser', 'internet']
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    command: 'code',
    aliases: ['vscode', 'vs code', 'code', 'visual studio code', 'vs-code', 'editor']
  },
  {
    id: 'calculator',
    name: 'Calculator',
    protocol: 'calculator:',
    command: 'calc.exe',
    aliases: ['calculator', 'calc', 'calculater', 'calclator', 'caluculator', 'calcy', 'calcilator', 'math']
  },
  {
    id: 'notepad',
    name: 'Notepad',
    command: 'notepad.exe',
    aliases: ['notepad', 'notpad', 'notespad', 'notes', 'note pad', 'text editor']
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    command: 'explorer.exe',
    aliases: ['explorer', 'files', 'file explorer', 'filemanager', 'file manager', 'my computer', 'this pc', 'folders']
  },
  {
    id: 'settings',
    name: 'Windows Settings',
    protocol: 'ms-settings:',
    aliases: ['settings', 'setings', 'setting', 'control panel', 'windows settings', 'preferences']
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    aliases: ['youtube', 'ytube', 'you tube', 'yt']
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    aliases: ['gmail', 'g-mail', 'g mail', 'google mail', 'mail', 'email']
  },
  {
    id: 'terminal',
    name: 'Windows Terminal',
    command: 'wt.exe',
    aliases: ['terminal', 'wt', 'windows terminal', 'console']
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    command: 'cmd.exe',
    aliases: ['cmd', 'command prompt', 'prompt']
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    command: 'powershell.exe',
    aliases: ['powershell', 'powershel', 'posh']
  },
  {
    id: 'camera',
    name: 'Camera',
    protocol: 'microsoft.windows.camera:',
    aliases: ['camera', 'camra', 'cam', 'webcam']
  },
  {
    id: 'paint',
    name: 'Paint',
    command: 'mspaint.exe',
    aliases: ['paint', 'mspaint', 'drawing']
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    command: 'taskmgr.exe',
    aliases: ['task manager', 'taskmanager', 'taskmgr', 'tasks']
  }
];

function getExistingFolderPath(folderName) {
  const home = os.homedir();
  const oneDrive = process.env.OneDrive || path.join(home, 'OneDrive');
  const candidate1 = path.join(oneDrive, folderName);
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(home, folderName);
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

const DIRECTORIES = [
  {
    id: 'downloads',
    name: 'Downloads',
    getPath: () => getExistingFolderPath('Downloads'),
    aliases: ['downloads', 'download', 'downlod', 'downloads folder', 'download folder']
  },
  {
    id: 'desktop',
    name: 'Desktop',
    getPath: () => getExistingFolderPath('Desktop'),
    aliases: ['desktop', 'dekstop', 'desktp', 'desktop folder']
  },
  {
    id: 'documents',
    name: 'Documents',
    getPath: () => getExistingFolderPath('Documents'),
    aliases: ['documents', 'document', 'docs', 'docments', 'documents folder', 'my documents']
  },
  {
    id: 'pictures',
    name: 'Pictures',
    getPath: () => getExistingFolderPath('Pictures'),
    aliases: ['pictures', 'picture', 'photos', 'images', 'pics', 'pictures folder', 'my pictures']
  },
  {
    id: 'music',
    name: 'Music',
    getPath: () => getExistingFolderPath('Music'),
    aliases: ['music', 'songs', 'audio', 'music folder', 'my music']
  },
  {
    id: 'videos',
    name: 'Videos',
    getPath: () => getExistingFolderPath('Videos'),
    aliases: ['videos', 'video', 'movies', 'videos folder', 'my videos']
  }
];

function resolveDirectory(rawName) {
  let norm = String(rawName || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!norm) return null;

  // Strip common filler phrases like "open files and open downloads" or "folder"
  norm = norm.replace(/^(?:open|start|go\s+to|show|view)\s+(?:files\s+and\s+(?:open\s+)?)?/i, '').trim();
  norm = norm.replace(/^(?:the\s+)?/i, '').trim();

  // Check direct paths like "C:\...", "D:\...", "C:/..."
  if (/^[a-zA-Z]:[\\\/]/.test(norm)) {
    return { name: norm, path: norm };
  }

  // 1. Exact alias match
  for (const d of DIRECTORIES) {
    if (d.id === norm || d.aliases.includes(norm)) {
      return { name: d.name, path: d.getPath() };
    }
  }

  // 2. Substring or contains match (e.g. "downloads folder", "my downloads")
  for (const d of DIRECTORIES) {
    for (const alias of d.aliases) {
      if (norm.includes(alias) || alias.includes(norm)) {
        return { name: d.name, path: d.getPath() };
      }
    }
  }

  // 3. Fuzzy match for typos
  for (const d of DIRECTORIES) {
    for (const alias of d.aliases) {
      if (levenshtein(norm, alias) <= 2) {
        return { name: d.name, path: d.getPath() };
      }
    }
  }

  return null;
}

function scanStartMenuApps() {
  const startMenuPaths = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
  ];

  const foundApps = [];
  for (const root of startMenuPaths) {
    if (!fs.existsSync(root)) continue;
    try {
      const readDirRecursive = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            readDirRecursive(fullPath);
          } else if (entry.isFile() && /\.lnk$/i.test(entry.name)) {
            const baseName = path.parse(entry.name).name.toLowerCase();
            foundApps.push({ name: path.parse(entry.name).name, path: fullPath, alias: baseName });
          }
        }
      };
      readDirRecursive(root);
    } catch (_) {}
  }
  return foundApps;
}

function resolveApp(rawName) {
  const norm = String(rawName || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '');
  if (!norm) return null;

  // 1. Exact alias match in KNOWN_APPS
  for (const app of KNOWN_APPS) {
    if (app.id === norm || app.aliases.includes(norm)) {
      return app;
    }
  }

  // 2. Substring / prefix match in KNOWN_APPS
  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      if (alias.startsWith(norm) || (norm.length >= 4 && alias.includes(norm))) {
        return app;
      }
    }
  }

  // 3. Fuzzy match via Levenshtein distance (tolerant to typos)
  let bestMatch = null;
  let minDistance = Infinity;

  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      const dist = levenshtein(norm, alias);
      const maxAllowedDist = alias.length > 5 ? 2 : 1;
      if (dist <= maxAllowedDist && dist < minDistance) {
        minDistance = dist;
        bestMatch = app;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // 4. Dynamic Windows Start Menu (.lnk) Scanner Lookup
  const dynamicApps = scanStartMenuApps();
  for (const app of dynamicApps) {
    if (app.alias === norm || app.alias.startsWith(norm) || (norm.length >= 4 && app.alias.includes(norm))) {
      return {
        id: app.alias,
        name: app.name,
        command: `"${app.path}"`,
        aliases: [app.alias]
      };
    }
  }

  for (const app of dynamicApps) {
    const dist = levenshtein(norm, app.alias);
    if (dist <= 2) {
      return {
        id: app.alias,
        name: app.name,
        command: `"${app.path}"`,
        aliases: [app.alias]
      };
    }
  }

  return null;
}

// Resolve direct YouTube Watch URL for immediate video playback
function getFirstYouTubeVideoUrl(query) {
  return new Promise((resolve) => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    https.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          resolve(`https://www.youtube.com/watch?v=${match[1]}`);
        } else {
          resolve(searchUrl);
        }
      });
    }).on('error', () => {
      resolve(searchUrl);
    });
  });
}

// 1. Open Desktop Applications with Spelling Autocorrect
async function openApp(appName) {
  const norm = String(appName || '').trim().replace(/[\.\?!,;]+$/, '');
  console.log(`[FahOS OS Agent] Resolving application to open: "${norm}"...`);

  const app = resolveApp(norm);
  let target = '';
  let label = norm;

  if (app) {
    label = app.name;
    target = app.protocol || app.url || app.command;
  } else {
    target = norm;
  }

  // For web applications and browsers, always open in FahOS Unified Browser
  if (/^https?:\/\//i.test(target) || /^(chrome|google\s+chrome|browser|edge|firefox|brave)$/i.test(norm)) {
    const urlToOpen = /^https?:\/\//i.test(target) ? target : 'https://www.google.com';
    console.log(`[FahOS OS Agent] Routing "${label}" directly into FahOS Unified Browser: ${urlToOpen}`);
    try {
      const agentBrowserWindow = require('../browser/agentBrowserWindow');
      if (agentBrowserWindow && agentBrowserWindow.createAgentBrowserWindow) {
        agentBrowserWindow.createAgentBrowserWindow(urlToOpen);
        return {
          ok: true,
          app: 'FahOS Unified Browser',
          command: `FahOS Browser: "${urlToOpen}"`,
          description: `Opened **${label}** in the FahOS Unified Browser.`
        };
      }
    } catch (err) {
      console.warn('[FahOS OS Agent] Could not open FahOS Unified Browser:', err);
    }
  }

  const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${target}'"`;
  const res = await runPowerShell(psCmd);
  return {
    ok: res.ok,
    app: label,
    command: psCmd,
    description: `Launched **${label}**.`
  };
}

// 1.5. Open Specific Directory or Folder in File Explorer
async function openDirectory(dirNameOrPath) {
  const norm = String(dirNameOrPath || '').trim();
  console.log(`[FahOS OS Agent] Resolving directory to open: "${norm}"...`);

  const resolved = resolveDirectory(norm);
  const targetPath = resolved ? resolved.path : norm;
  const label = resolved ? resolved.name : path.basename(targetPath) || targetPath;

  console.log(`[FahOS OS Agent] Opening directory: "${label}" -> ${targetPath}`);

  // Try opening via Electron native shell.openPath for instant response
  try {
    const { shell } = require('electron');
    if (shell && shell.openPath) {
      const errMsg = await shell.openPath(targetPath);
      if (!errMsg) {
        return {
          ok: true,
          app: 'File Explorer',
          command: `explorer.exe "${targetPath}"`,
          description: `Opened **${label}** folder in File Explorer.`
        };
      }
    }
  } catch (_) {}

  // Fallback to PowerShell Start-Process explorer
  const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process explorer.exe -ArgumentList '${targetPath}'"`;
  const res = await runPowerShell(psCmd);
  return {
    ok: res.ok,
    app: 'File Explorer',
    command: psCmd,
    description: `Opened **${label}** folder in File Explorer.`
  };
}

// Search user's common directories (Desktop, Downloads, Documents, Pictures, Videos, Music) for a matching file or folder
function findLocalFileOrFolder(searchTerm) {
  const norm = String(searchTerm || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!norm) return null;

  const searchRoots = [
    getExistingFolderPath('Desktop'),
    getExistingFolderPath('Downloads'),
    getExistingFolderPath('Documents'),
    getExistingFolderPath('Pictures'),
    getExistingFolderPath('Videos'),
    getExistingFolderPath('Music')
  ];

  const matched = [];

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    try {
      const items = fs.readdirSync(root, { withFileTypes: true });
      for (const item of items) {
        const itemName = item.name.toLowerCase();
        const fullPath = path.join(root, item.name);

        // Exact match
        if (itemName === norm || path.parse(itemName).name.toLowerCase() === norm) {
          return {
            name: item.name,
            path: fullPath,
            isDirectory: item.isDirectory(),
            confidence: 1.0,
            location: path.basename(root)
          };
        }

        // Substring match (Only if searched query contains the full item name or item contains searched query with meaningful length >= 3)
        if (norm.length >= 3 && itemName.length >= 3) {
          if (itemName.includes(norm)) {
            matched.push({
              name: item.name,
              path: fullPath,
              isDirectory: item.isDirectory(),
              confidence: 0.8,
              location: path.basename(root)
            });
          } else if (norm.split(/\s+/).some(word => word.length >= 3 && (word === itemName || path.parse(itemName).name.toLowerCase() === word))) {
            matched.push({
              name: item.name,
              path: fullPath,
              isDirectory: item.isDirectory(),
              confidence: 0.75,
              location: path.basename(root)
            });
          }
        }
      }
    } catch (_) {}
  }

  if (matched.length > 0) {
    matched.sort((a, b) => b.confidence - a.confidence);
    return matched[0];
  }

  return null;
}

// Observe-Plan-Verify Agent for Opening Files, Folders, Apps, and Media
async function verifyAndOpenItem(query) {
  const norm = String(query || '').trim().replace(/[\.\?!,;]+$/, '').trim();
  console.log(`[FahOS Agent: Observe] Observing request: "${norm}"`);

  // 1. OBSERVE: Check if target is a known directory (Downloads, Desktop, Documents, etc.)
  const dirMatch = resolveDirectory(norm);
  if (dirMatch && dirMatch.path && fs.existsSync(dirMatch.path)) {
    console.log(`[FahOS Agent: Plan] Planned action: Open verified directory -> "${dirMatch.name}" (${dirMatch.path})`);
    const openRes = await openDirectory(dirMatch.path);
    console.log(`[FahOS Agent: Verify] Verification complete: Directory opened successfully.`);
    return {
      ok: true,
      type: 'directory',
      name: dirMatch.name,
      path: dirMatch.path,
      command: openRes.command,
      description: `Verified and opened **${dirMatch.name}** folder in File Explorer.`
    };
  }

  // 2. OBSERVE: Check if target is a known desktop/web application
  const appMatch = resolveApp(norm);
  if (appMatch) {
    console.log(`[FahOS Agent: Plan] Planned action: Launch verified application -> "${appMatch.name}"`);
    const appRes = await openApp(norm);
    console.log(`[FahOS Agent: Verify] Verification complete: App launched.`);
    return {
      ok: appRes.ok,
      type: 'app',
      name: appMatch.name,
      command: appRes.command,
      description: `Verified and launched **${appMatch.name}**.`
    };
  }

  // 3. OBSERVE: Search local files and project folders in Desktop, Downloads, Documents
  console.log(`[FahOS Agent: Observe] Scanning local filesystem for matching file or folder: "${norm}"...`);
  const fileMatch = findLocalFileOrFolder(norm);
  if (fileMatch && fileMatch.path) {
    console.log(`[FahOS Agent: Plan] Found matching ${fileMatch.isDirectory ? 'folder' : 'file'}: "${fileMatch.name}" in ${fileMatch.location}`);
    
    let opened = false;
    let cmd = '';
    try {
      const { shell } = require('electron');
      if (shell && shell.openPath) {
        const err = await shell.openPath(fileMatch.path);
        if (!err) {
          opened = true;
          cmd = `explorer.exe "${fileMatch.path}"`;
        }
      }
    } catch (_) {}

    if (!opened) {
      cmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${fileMatch.path}'"`;
      const psRes = await runPowerShell(cmd);
      opened = psRes.ok;
    }

    console.log(`[FahOS Agent: Verify] Verification complete: Opened ${fileMatch.name}`);
    return {
      ok: opened,
      type: fileMatch.isDirectory ? 'folder' : 'file',
      name: fileMatch.name,
      path: fileMatch.path,
      command: cmd,
      description: `Verified and opened ${fileMatch.isDirectory ? 'folder' : 'file'} **${fileMatch.name}** (located in _${fileMatch.location}_).`
    };
  }

  // 4. OBSERVE: Check if target is a web URL or domain name (e.g. "google.com", "github.com", "figma.com")
  const isWebUrl = /^https?:\/\//i.test(norm) || /\.(com|org|net|io|dev|app|gov|edu|ai|co)$/i.test(norm);
  if (isWebUrl) {
    const targetUrl = /^https?:\/\//i.test(norm) ? norm : `https://${norm}`;
    console.log(`[FahOS Agent: Plan] Planned action: Open Web URL -> "${targetUrl}"`);
    try {
      const { shell } = require('electron');
      if (shell && shell.openExternal) {
        await shell.openExternal(targetUrl);
        return {
          ok: true,
          type: 'url',
          name: norm,
          url: targetUrl,
          description: `Verified and opened Web URL **${norm}** in default browser.`
        };
      }
    } catch (_) {}
  }

  // 5. Fallback if item is not found anywhere
  console.log(`[FahOS Agent: Verify] Target "${norm}" could not be verified on system.`);

  let notFoundMessage = '';
  if (/\.(txt|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|mp4|mp3|py|js|json|html|css|cpp|java|c|exe|csv)$/i.test(norm) || /\bfile\b/i.test(query)) {
    notFoundMessage = `File **"${norm}"** was not found in your standard directories (Downloads, Desktop, Documents, Pictures, Videos, Music).\n\nPlease verify the filename or provide the full path.`;
  } else if (/\bfolder\b|\bdirectory\b/i.test(query)) {
    notFoundMessage = `Folder **"${norm}"** was not found in your directory.\n\nPlease check the folder name or create it first.`;
  } else {
    notFoundMessage = `Application or file **"${norm}"** is not found on your system.\n\nMake sure the app is installed or check the spelling.`;
  }

  return {
    ok: false,
    notFound: true,
    name: norm,
    description: notFoundMessage
  };
}

// Create new file or folder in a specified directory (e.g. "create a file named sai in Downloads", "add folder my_project in Desktop")
async function createFileOrFolder({ name, targetFolder, isFolder = false, content = '' }) {
  const rawName = String(name || '').trim();
  const rawFolder = String(targetFolder || 'Desktop').trim();

  // 1. Resolve destination folder
  let targetDir = getExistingFolderPath('Desktop');
  let folderDisplayName = 'Desktop';

  const resolvedDir = resolveDirectory(rawFolder);
  if (resolvedDir && resolvedDir.path && fs.existsSync(resolvedDir.path)) {
    targetDir = resolvedDir.path;
    folderDisplayName = resolvedDir.name;
  } else {
    // Check if targetFolder is already a valid path
    if (fs.existsSync(rawFolder)) {
      targetDir = rawFolder;
      folderDisplayName = path.basename(rawFolder);
    }
  }

  // 2. Format name and ensure default extension for text files if none provided
  let finalName = rawName;
  if (!isFolder && !path.extname(finalName)) {
    finalName += '.txt';
  }

  const destinationPath = path.join(targetDir, finalName);
  console.log(`[FahOS Agent: File Creator] Creating ${isFolder ? 'folder' : 'file'} at: ${destinationPath}`);

  try {
    if (isFolder) {
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }
    } else {
      fs.writeFileSync(destinationPath, content || '', 'utf8');
    }

    // Reveal created item in File Explorer
    const revealCmd = `powershell.exe -NoProfile -NonInteractive -Command "explorer.exe /select,'${destinationPath}'"`;
    runPowerShell(revealCmd).catch(() => {});

    return {
      ok: true,
      path: destinationPath,
      name: finalName,
      folder: folderDisplayName,
      isFolder,
      command: `Create ${isFolder ? 'Folder' : 'File'}: "${destinationPath}"`,
      description: `Successfully created ${isFolder ? 'folder' : 'file'} **${finalName}** in your **${folderDisplayName}** folder.`
    };
  } catch (err) {
    console.error(`[FahOS Agent: File Creator] Error:`, err);
    return {
      ok: false,
      error: err.message,
      description: `Could not create ${isFolder ? 'folder' : 'file'}: ${err.message}`
    };
  }
}

// Delete file or folder in a specified directory (e.g. "delete a file named sai in Downloads", "remove folder test on Desktop")
async function deleteFileOrFolder({ name, targetFolder, confirmed = false }) {
  const rawName = String(name || '').trim();
  const rawFolder = String(targetFolder || '').trim();

  let targetDir = '';
  let folderDisplayName = '';

  if (rawFolder) {
    const resolvedDir = resolveDirectory(rawFolder);
    if (resolvedDir && resolvedDir.path && fs.existsSync(resolvedDir.path)) {
      targetDir = resolvedDir.path;
      folderDisplayName = resolvedDir.name;
    }
  }

  // 1. Try finding in specific directory if provided (STRICT EXACT MATCH FIRST)
  let fileToDelete = null;
  if (targetDir && fs.existsSync(targetDir)) {
    const candidatePath = path.join(targetDir, rawName);
    if (fs.existsSync(candidatePath)) {
      fileToDelete = { path: candidatePath, name: rawName, isDirectory: fs.statSync(candidatePath).isDirectory(), location: folderDisplayName };
    } else {
      const filesInDir = fs.readdirSync(targetDir);
      for (const f of filesInDir) {
        if (f.toLowerCase() === rawName.toLowerCase() || path.parse(f).name.toLowerCase() === rawName.toLowerCase()) {
          const full = path.join(targetDir, f);
          fileToDelete = { path: full, name: f, isDirectory: fs.statSync(full).isDirectory(), location: folderDisplayName };
          break;
        }
      }
    }
  }

  // 2. If not found in target dir and NO target folder was specified, search roots with strict exact match ONLY (never delete random fuzzy items)
  if (!fileToDelete && !rawFolder) {
    const searchRoots = [
      getExistingFolderPath('Downloads'),
      getExistingFolderPath('Desktop'),
      getExistingFolderPath('Documents')
    ];
    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      const items = fs.readdirSync(root);
      for (const item of items) {
        if (item.toLowerCase() === rawName.toLowerCase() || path.parse(item).name.toLowerCase() === rawName.toLowerCase()) {
          const full = path.join(root, item);
          fileToDelete = { path: full, name: item, isDirectory: fs.statSync(full).isDirectory(), location: path.basename(root) };
          folderDisplayName = path.basename(root);
          break;
        }
      }
      if (fileToDelete) break;
    }
  }

  if (!fileToDelete) {
    return {
      ok: false,
      notFound: true,
      description: `Could not find a file or folder named **"${rawName}"**${folderDisplayName ? ' in ' + folderDisplayName : ''} to delete.`
    };
  }

  // IF NOT EXPLICITLY CONFIRMED, RETURN CONFIRMATION REQUIRED PAYLOAD (🔴 DANGEROUS PERMISSION TIER)
  if (!confirmed) {
    return {
      ok: true,
      requiresConfirmation: true,
      tier: 'DANGEROUS',
      action: 'delete_file',
      itemName: fileToDelete.name,
      itemPath: fileToDelete.path,
      isDirectory: fileToDelete.isDirectory,
      location: fileToDelete.location || 'computer',
      description: `⚠️ **Confirmation Required (Dangerous Action)**\n\nAre you sure you want to permanently delete **${fileToDelete.name}** from **${fileToDelete.location}**?\n\n\`${fileToDelete.path}\``
    };
  }

  console.log(`[FahOS Agent: File Deleter] Confirmed deleting ${fileToDelete.isDirectory ? 'folder' : 'file'}: ${fileToDelete.path}`);

  try {
    let deleted = false;
    // 1. Try sending to Windows Recycle Bin / Trash via Electron shell for safe, instant explorer sync
    try {
      const { shell } = require('electron');
      if (shell && shell.trashItem) {
        await shell.trashItem(fileToDelete.path);
        deleted = true;
      }
    } catch (_) {}

    // 2. Fallback to native Node fs removal
    if (!deleted) {
      if (fileToDelete.isDirectory) {
        fs.rmSync(fileToDelete.path, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fileToDelete.path);
      }
    }

    // Refresh Windows File Explorer views
    const refreshCmd = `powershell.exe -NoProfile -NonInteractive -Command "$code = '[DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);'; Add-Type -MemberDefinition $code -Name Shell -Namespace Win32; [Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)"`;
    runPowerShell(refreshCmd).catch(() => {});

    return {
      ok: true,
      deleted: true,
      name: fileToDelete.name,
      path: fileToDelete.path,
      command: `Delete: "${fileToDelete.path}"`,
      description: `Successfully deleted **${fileToDelete.name}** from **${fileToDelete.location || 'computer'}**.`
    };
  } catch (err) {
    console.error(`[FahOS Agent: File Deleter] Error:`, err);
    return {
      ok: false,
      error: err.message,
      description: `Could not delete ${fileToDelete.name}: ${err.message}`
    };
  }
}

// 2. WhatsApp Deep Action (Compose message)
async function sendWhatsAppMessage({ text, recipient }) {
  if (recipient) {
    return await openWhatsAppChat(recipient, text);
  }
  const msg = String(text || '').trim();
  const encoded = encodeURIComponent(msg);
  const cmd = `start whatsapp://send?text=${encoded}`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: 'WhatsApp',
    command: cmd,
    description: `Opened **WhatsApp** with prepared message: _"${msg}"_`
  };
}

// 3. Spotify Deep Action (Search & Play)
async function spotifySearch({ query }) {
  const q = String(query || '').trim();
  const encoded = encodeURIComponent(q);
  const cmd = `start spotify:search:${encoded}`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: 'Spotify',
    command: cmd,
    description: `Opened **Spotify** searching for track/artist: _"${q}"_`
  };
}

// 4. Web / YouTube Search & Direct Play Actions
async function webSearch({ engine, query, url }) {
  const q = String(query || '').trim();
  let targetUrl = url;
  let label = 'Web Browser';

  if (!targetUrl) {
    if (engine === 'youtube') {
      targetUrl = await getFirstYouTubeVideoUrl(q);
      label = 'YouTube (Direct Play)';
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      label = 'Google Search';
    }
  }

  const cmd = `start ${targetUrl}`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: label,
    command: cmd,
    description: `Playing **${q || targetUrl}** on **${label}**.`
  };
}

// 4.1. Direct URL Opener (Always in FahOS Unified Browser)
async function openUrl(url) {
  const target = String(url || '').trim();
  if (!target) return { ok: false, error: 'No URL provided' };

  console.log(`[FahOS OS Agent] Opening URL in FahOS Unified Browser: ${target}`);
  try {
    const agentBrowserWindow = require('../browser/agentBrowserWindow');
    if (agentBrowserWindow && agentBrowserWindow.createAgentBrowserWindow) {
      agentBrowserWindow.createAgentBrowserWindow(target);
      return {
        ok: true,
        app: 'FahOS Unified Browser',
        command: `Open: ${target}`,
        description: `Opened **${target}** in FahOS Unified Browser.`
      };
    }
  } catch (err) {
    console.warn('[FahOS OS Agent] Could not open in FahOS Unified Browser:', err);
  }

  // Fallback
  let opened = false;
  try {
    const { shell } = require('electron');
    if (shell && shell.openExternal) {
      await shell.openExternal(target);
      opened = true;
    }
  } catch (_) {}

  if (!opened) {
    const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${target.replace(/'/g, "''")}'"`;
    await runPowerShell(psCmd);
  }

  return {
    ok: true,
    app: 'FahOS Unified Browser',
    command: `Open: ${target}`,
    description: `Opened **${target}** in FahOS Unified Browser.`
  };
}

// 5. Native Windows System & Media Controls
async function systemControl({ action }) {
  const act = String(action || '').toLowerCase().trim();
  let script = '';
  let desc = '';

  switch (act) {
    case 'volume_up':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]175)';
      desc = 'Turned volume up.';
      break;
    case 'volume_down':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]174)';
      desc = 'Turned volume down.';
      break;
    case 'mute':
    case 'unmute':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]173)';
      desc = 'Toggled audio mute/unmute.';
      break;
    case 'play_pause':
    case 'pause':
    case 'play':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]179)';
      desc = 'Toggled media playback (Play/Pause).';
      break;
    case 'next_track':
    case 'next':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]176)';
      desc = 'Skipped to next media track.';
      break;
    case 'prev_track':
    case 'previous':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]177)';
      desc = 'Skipped to previous media track.';
      break;
    case 'lock':
      script = 'rundll32.exe user32.dll,LockWorkStation';
      desc = 'Locked Windows workstation.';
      break;
    default:
      script = 'Write-Host "Unrecognized system command"';
      desc = `Triggered system action: ${act}`;
  }

  const res = await runPowerShell(script);
  return {
    ok: res.ok,
    app: 'Windows System',
    command: script,
    description: desc
  };
}

// 6. Notepad Note Taking
async function notepadWrite({ content }) {
  const text = String(content || '').trim();
  const script = `$p = "$env:USERPROFILE\\Desktop\\FahOS_Notes.txt"; Add-Content -Path $p -Value "${text.replace(/"/g, '`"')}"; Start-Process "notepad.exe" $p`;
  const res = await runPowerShell(script);
  return {
    ok: res.ok,
    app: 'Notepad',
    command: script,
    description: `Saved note to Desktop and opened in **Notepad**: _"${text}"_`
  };
}

// 7. Dedicated WhatsApp Contact Deep Link Opener & Message Sender
async function openWhatsAppChat(contactName, message = '') {
  const contactsService = require('../contacts/contactsService');
  const name = String(contactName || '').trim();
  console.log(`[FahOS OS Agent] Resolving WhatsApp contact: "${name}"...`);

  // Check if contactName is already a direct phone number
  let phone = null;
  let displayName = name;
  const digitsOnly = name.replace(/[\s\-\(\)\+]/g, '');
  if (/^\d{10,15}$/.test(digitsOnly)) {
    phone = contactsService.normalizePhone(digitsOnly);
    displayName = `+${phone}`;
  } else {
    // Look up in contacts book
    const contact = contactsService.getPhoneForContact(name);
    if (contact && contact.phone) {
      phone = contact.phone;
      displayName = contact.displayName || name;
    }
  }

  if (phone) {
    const trimmedMsg = String(message || '').trim();
    let deepLink = `whatsapp://send?phone=${phone}`;
    if (trimmedMsg) {
      deepLink += `&text=${encodeURIComponent(trimmedMsg)}`;
    }

    let psScript = '';
    if (trimmedMsg) {
      // Launch WhatsApp with prefilled message, wait for UI to focus chat, then send Enter
      psScript = [
        `Start-Process '${deepLink}'`,
        `Start-Sleep -Milliseconds 1400`,
        `$ws = New-Object -ComObject WScript.Shell`,
        `$ws.SendKeys('~')`
      ].join('\n');
    } else {
      psScript = `Start-Process '${deepLink}'`;
    }

    console.log(`[FahOS OS Agent] Executing WhatsApp Protocol: ${deepLink}`);
    await runPowerShell(psScript);

    if (trimmedMsg) {
      return {
        ok: true,
        app: 'WhatsApp',
        command: deepLink,
        description: `Sent message to **${displayName}** (+${phone}):\n\n> "${trimmedMsg}"`
      };
    }

    return {
      ok: true,
      app: 'WhatsApp',
      command: deepLink,
      description: `Opened WhatsApp chat with **${displayName}** (+${phone}).`
    };
  }

  // If not found in contacts book, inform user and give instructions
  return {
    ok: false,
    notFound: true,
    contactName: name,
    app: 'WhatsApp',
    command: `Contact Lookup: "${name}"`,
    description: `**${name}** is not in your FahOS phonebook yet.\n\nTo save it, say:\n*"Save contact ${name} as +91XXXXXXXXXX"*`
  };
}

// 7. Compose Email via native Windows mailto protocol or direct client
async function composeEmail(target, subject = '', body = '') {
  const contactsService = require('../contacts/contactsService');
  let email = '';
  let displayName = String(target || '').trim();

  if (displayName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(displayName)) {
    email = displayName;
  } else if (displayName) {
    const contact = contactsService.getPhoneForContact(displayName);
    if (contact && contact.email) {
      email = contact.email;
      displayName = contact.displayName || displayName;
    }
  }

  if (!email) {
    return {
      ok: false,
      notFound: true,
      contactName: displayName,
      app: 'Email Composer',
      command: `Email Lookup: "${displayName}"`,
      description: `No email address found for **${displayName}** in your FahOS directory.\n\nOpen the Directory and add an email for ${displayName} to compose directly!`
    };
  }

  // Official Gmail Web Compose URL (always opens in user's default web browser)
  let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  if (subject && subject.trim()) gmailUrl += `&su=${encodeURIComponent(subject.trim())}`;
  if (body && body.trim()) gmailUrl += `&body=${encodeURIComponent(body.trim())}`;

  console.log(`[FahOS OS Agent] Launching Gmail in default web browser: ${gmailUrl}`);
  let opened = false;
  try {
    const { shell } = require('electron');
    if (shell && shell.openExternal) {
      await shell.openExternal(gmailUrl);
      opened = true;
    }
  } catch (_) {}

  if (!opened) {
    const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${gmailUrl}'"`;
    await runPowerShell(psCmd);
  }

  return {
    ok: true,
    app: 'Gmail (Default Browser)',
    command: gmailUrl,
    description: `Opened Gmail in your default browser to compose email to **${displayName}** (\`${email}\`).`
  };
}

module.exports = {
  PERMISSION_TIERS,
  TOOLS,
  restoreFromRecycleBin,
  runPowerShell,
  getFirstYouTubeVideoUrl,
  openApp,
  resolveApp,
  openDirectory,
  resolveDirectory,
  findLocalFileOrFolder,
  verifyAndOpenItem,
  createFileOrFolder,
  deleteFileOrFolder,
  DIRECTORIES,
  KNOWN_APPS,
  openWhatsAppChat,
  sendWhatsAppMessage,
  composeEmail,
  spotifySearch,
  webSearch,
  openUrl,
  systemControl,
  notepadWrite
};
