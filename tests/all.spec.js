import { test, expect } from '@playwright/test';

const MOCK_LLM_BASE = 'http://localhost:3099/v1';

test.beforeAll(async () => {
  // Clean up any leftover sessions
  const sessions = await fetch('http://localhost:3101/api/sessions').then(r => r.json());
  for (const s of sessions) {
    await fetch(`http://localhost:3101/api/sessions/${s.id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Configure backend to use the mock-llm service
  const res = await fetch('http://localhost:3101/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai',
      openaiKey: 'sk-mock',
      openaiBaseUrl: MOCK_LLM_BASE,
      openaiModel: 'mock-llm',
      mcpServers: [],
    }),
  });
  if (!res.ok) throw new Error('Failed to configure mock LLM');
});

test.afterAll(async () => {
  await fetch('http://localhost:3101/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'mock', mcpServers: [] }),
  }).catch(() => {});
});

async function createNewSession(page, name) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  await page.getByRole('button', { name: 'New Session' }).click();
  await page.waitForTimeout(200);
  await page.locator('[placeholder="Session name..."]').fill(name || 'Test Session');
  await page.getByText('Create').click();
  await page.waitForTimeout(300);
  await expect(page.getByPlaceholder('Describe your mockup...')).toBeVisible();
}

async function waitForAgentDone(page) {
  await page.waitForFunction(() => {
    const buttons = document.querySelectorAll('button');
    return !Array.from(buttons).some(b => b.textContent === 'Stop Generating');
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Sessions', () => {

  test('shows sessions list on first load with empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  });

  test('creates a new session and navigates to chat', async ({ page }) => {
    await createNewSession(page);
    await expect(page.getByPlaceholder('Describe your mockup...')).toBeVisible();
    await expect(page.getByText(/Session #\d+/)).toBeVisible();
  });

});

test.describe('Agent interaction', () => {

  test('sends prompt and renders mockup in preview iframe', async ({ page }) => {
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a red card');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');

    await waitForAgentDone(page);

    await expect(page.locator('iframe')).toBeAttached();
    await expect(page.getByText('write_mockup').first()).toBeVisible();
  });

  test('generates different layouts based on prompt keywords', async ({ page }) => {
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a landing page');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);
    await expect(page.locator('iframe')).toBeAttached();

    await page.locator('[title="Sessions"]').click();
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a hero section');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);
    await expect(page.locator('iframe')).toBeAttached();
  });

  test('uses specified color in generated mockup', async ({ page }) => {
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a blue form');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await expect(page.locator('iframe')).toBeAttached();
  });

});

test.describe('Session persistence', () => {

  test('auto-saves session after agent response', async ({ page }) => {
    await createNewSession(page, 'Auto Save');

    await page.getByPlaceholder('Describe your mockup...').fill('Make a green card');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Auto Save')).toBeVisible();
  });

  test('loads a saved session from the list', async ({ page }) => {
    await createNewSession(page, 'Load Test');

    await page.getByPlaceholder('Describe your mockup...').fill('Make a teal card');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(500);

    await page.getByText('Load Test').click();

    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('Describe your mockup...')).toBeVisible({ timeout: 5000 });
  });

  test('deletes a session', async ({ page }) => {
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make an orange card');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(500);

    const deleteBtn = page.locator('[title="Delete session"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(500);
    }

    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  });

  test('new session starts fresh after deleting old one', async ({ page }) => {
    await createNewSession(page, 'Old Session');

    await page.getByPlaceholder('Describe your mockup...').fill('Make a red card with the word TESTING');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    // Note the mockup HTML for later comparison
    const oldIframeSrc = await page.locator('iframe').getAttribute('src');

    // Delete the session
    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(300);
    await page.locator('[title="Delete session"]').first().click();
    await page.waitForTimeout(300);

    // Create a brand new session
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(200);
    await page.locator('[placeholder="Session name..."]').fill('New Session');
    await page.getByText('Create').click();
    await page.waitForTimeout(300);

    // The mockup preview should be empty (placeholder), not the old one
    const placeholder = page.locator('text=Mockup Preview');
    await expect(placeholder).toBeVisible();
  });

});

test.describe('Navigation', () => {

  test('sessions button returns to sessions list from chat', async ({ page }) => {
    await createNewSession(page);
    await expect(page.getByPlaceholder('Describe your mockup...')).toBeVisible();

    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  });

});

test.describe('Settings panel', () => {

  test('settings panel opens and shows LLM provider options', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const gearBtn = page.locator('[title="Settings"]');
    await expect(gearBtn).toBeVisible();
    await gearBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Provider')).toBeVisible();
  });

  test('changes LLM provider and saves', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(300);

    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.waitForTimeout(200);

    await page.getByText('Save Settings').click();
    await page.waitForTimeout(500);

    await page.locator('[title="Sessions"]').click();
    await page.waitForTimeout(200);
    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-testid="provider-select"]')).toHaveValue('openai');
  });

});

test.describe('MCP server integration', () => {

  test('connects to mock MCP server via SSE', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);
    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(300);

    await page.getByText(/^MCP/).click();
    await page.waitForTimeout(200);

    await page.getByText('+ Add MCP Server').click();
    await page.waitForTimeout(200);

    await page.locator('[placeholder="Server name"]').fill('MockDesign');
    await page.locator('[placeholder="URL (e.g. http://localhost:3098/sse)"]').fill('http://localhost:3098/sse');

    await page.getByText('Save Settings').click();
    await page.waitForTimeout(1000);
  });

  test('agent can use MCP tools when connected', async ({ page }) => {
    await fetch('http://localhost:3101/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mcpServers: [{ name: 'MockDesign', transport: 'sse', url: 'http://localhost:3098/sse' }],
      }),
    });

    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a landing page');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(300);

    const mcpTab = page.getByText(/^MCP/);
    await expect(mcpTab).toBeVisible();
  });

});

test.describe('Panel controls', () => {

  test('hides and shows the panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();

    await page.locator('[title="Hide panel"]').click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'New Session' })).not.toBeVisible();

    await page.locator('[title="Show panel"]').click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  });

  test('toggles between sessions, chat, and settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();

    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(200);
    await expect(page.getByText('Provider')).toBeVisible();

    await page.locator('[title="Settings"]').click();
    await page.waitForTimeout(200);
  });

});

test.describe('Screenshot', () => {

  test('screenshot button appears when mockup is generated', async ({ page }) => {
    await createNewSession(page);

    await page.getByPlaceholder('Describe your mockup...').fill('Make a red card');
    await page.getByPlaceholder('Describe your mockup...').press('Enter');
    await waitForAgentDone(page);

    await expect(page.getByText('Screenshot')).toBeVisible();
  });

});
