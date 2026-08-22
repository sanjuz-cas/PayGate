import { evaluateInboundLetter } from './src/lib/autonomy.js';
import { loadAgentEnv } from './src/lib/env.js';

async function testLLM() {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  
  if (!apiKey) {
    console.log('No ANTHROPIC_API_KEY provided. Testing rules-based fallback path.');
    console.log('\n=== RULES-BASED FALLBACK TESTS ===\n');
  } else {
    console.log('ANTHROPIC_API_KEY is set. Testing LLM-powered path.\n');
  }

  const env = loadAgentEnv({
    AGENT_MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest',
    AGENT_DAILY_CAP_USDC: '5.0',
    AUTONOMOUS_UNLOCK_ENABLED: 'true',
    ANTHROPIC_API_KEY: apiKey
  });

  const testCases = [
    { 
      letterId: 'tax1', 
      from: 'City Tax Office Schnitzelburg', 
      envelopeSummary: 'Annual Tax Assessment Notice 2026',
      description: 'Tax Letter (should be unlock)'
    },
    { 
      letterId: 'promo1', 
      from: 'Casino Super Deals', 
      envelopeSummary: 'Claim your $5,000 lottery promo discount free gift!',
      description: 'Promo Letter (should be ignore)'
    },
    { 
      letterId: 'unknown1', 
      from: 'Random Strangers Club', 
      envelopeSummary: 'General correspondence regarding nothing specific',
      description: 'Unknown Letter (should be defer)'
    }
  ];

  for (const tc of testCases) {
    console.log(`\n--- ${tc.description} ---`);
    console.log(`From: ${tc.from}`);
    console.log(`Summary: ${tc.envelopeSummary}`);
    
    const decision = await evaluateInboundLetter(
      { letterId: tc.letterId, from: tc.from, envelopeSummary: tc.envelopeSummary },
      env
    );
    
    console.log(`Decision: ${decision.decision}`);
    console.log(`Reason: ${decision.reason}`);
    console.log(`Confidence: ${decision.confidence}`);
  }
  
  console.log('\n=== ALL TESTS COMPLETED ===\n');
}

testLLM().catch(console.error);
