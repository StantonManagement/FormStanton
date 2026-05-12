import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function GET() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      cwd: process.cwd(),
      encoding: 'utf-8' 
    }).trim();

    const lastCommitDate = execSync('git log -1 --format=%cd --date=iso', { 
      cwd: process.cwd(),
      encoding: 'utf-8' 
    }).trim();

    const lastCommitHash = execSync('git log -1 --format=%h', { 
      cwd: process.cwd(),
      encoding: 'utf-8' 
    }).trim();

    return NextResponse.json({ 
      success: true, 
      branch,
      lastCommitDate,
      lastCommitHash
    });
  } catch {
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to get git info' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
