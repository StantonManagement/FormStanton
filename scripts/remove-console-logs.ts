import * as fs from 'fs';
import * as path from 'path';

// Directories to clean
const directories = [
  'app',
  'components',
  'lib'
];

// Files to skip
const skipFiles = new Set([
  'node_modules',
  '.next',
  '.git'
]);

function shouldProcessFile(filePath: string): boolean {
  return (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && 
         !filePath.includes('node_modules') &&
         !filePath.includes('.next');
}

function removeConsoleLogs(content: string): { content: string; removed: number } {
  let removed = 0;
  
  // Remove standalone console.log statements (keep console.error)
  const lines = content.split('\n');
  const newLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip lines that are only console.log
    if (trimmed.startsWith('console.log(')) {
      removed++;
      continue;
    }
    
    // Remove inline console.log but keep the line structure
    if (line.includes('console.log(') && !line.includes('console.error')) {
      // Replace console.log with a comment
      const replaced = line.replace(/console\.log\([^)]*\);?/g, '// Debug log removed');
      newLines.push(replaced);
      removed++;
    } else {
      newLines.push(line);
    }
  }
  
  return {
    content: newLines.join('\n'),
    removed
  };
}

function processDirectory(dir: string): void {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!skipFiles.has(file)) {
        processDirectory(filePath);
      }
    } else if (shouldProcessFile(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { content: newContent, removed } = removeConsoleLogs(content);
      
      if (removed > 0) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✓ ${filePath}: Removed ${removed} console.log statement(s)`);
      }
    }
  }
}

console.log('Starting console.log removal...\n');

for (const dir of directories) {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`Processing ${dir}/...`);
    processDirectory(fullPath);
  }
}

console.log('\n✓ Console.log cleanup complete!');
