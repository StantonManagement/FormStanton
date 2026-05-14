import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOcr } from '../intake/ocr';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

describe('runOcr', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
    vi.stubEnv('INTAKE_OCR_MODEL', 'claude-opus-4-5');
  });

  it('returns extracted text and confidence for a paycheck', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Employee Pay Period: 04/01 - 04/15\nGross Pay: $2,450.00 Net Pay: $1,900.00 YTD Earnings: $12,250.00\nEmployee: Maria Santos\nDeductions: Federal Tax $350.00 State Tax $100.00 Social Security $150.00\nDepartment: Operations\nEarnings Statement — Please keep for your records.',
        },
      ],
    });
    const result = await runOcr('base64fakeimage==');
    expect(result.text).toContain('Pay Period');
    expect(result.text).toContain('Gross Pay');
    expect(['high', 'medium']).toContain(result.confidence);
  });

  it('returns none confidence for blank API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-your-key-here');
    const result = await runOcr('base64fakeimage==');
    expect(result.text).toBe('');
    expect(result.confidence).toBe('none');
  });

  it('handles SDK errors gracefully', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
    mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    const result = await runOcr('base64fakeimage==');
    expect(result.text).toBe('');
    expect(result.confidence).toBe('none');
  });
});
