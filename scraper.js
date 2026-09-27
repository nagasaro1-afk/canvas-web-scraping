const { chromium } = require('playwright');
const fs = require('fs'); // Built-in Node.js module to write files

async function scrapeALUCanvas() {
  // 1. Launch a normal, visible browser window
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to ALU Canvas...');
  await page.goto('https://alueducation.instructure.com/');

  // 2. PAUSE AND HANDOFF TO STUDENT FOR GOOGLE AND 2FA LOGIN
  console.log('\n======================================================');
  console.log('ACTION REQUIRED: Please log in using your student Google account.');
  console.log('Complete any 2FA prompts on your mobile device if required.');
  console.log('======================================================\n');

await page.waitForSelector('.ic-DashboardCard', { timeout: 0 });
  console.log('Login verified! Arrived at the Canvas Dashboard.');

  console.log('Navigating to the "Frontend Web development" course...');

  // 3. Navigate into the Course and to the Assignments tab
  await page.getByRole('link', { name: 'Frontend Web development' }).first().click();
  await page.getByRole('link', { name: 'Assignments' }).click();

  await page.waitForSelector('.ig-row');

  // 4. Locate all assignment cards or rows
  const assignmentRows = await page.locator('.assignment-list .ig-row').all();
  const scrapedAssignments = [];

  console.log(`Detected ${assignmentRows.length} items. Extracting DOM elements...`);

  if (assignmentRows.length === 0) {
    console.warn('\nWARNING: No assignment rows found. Check that the selectors ' +
      "(.ig-row, .ig-title, etc.) still match Canvas's current HTML.\n");
  }

  // 5. Loop through each row to safely pull details
  for (const row of assignmentRows) {
    try {
      const title = await row.locator('.ig-title').innerText();

      const dueDateElement = row.locator('.assignment-date-due');
      const dueDate = (await dueDateElement.count()) > 0
        ? await dueDateElement.innerText()
        : 'No due date';

      const statusElement = row.locator('.submission-status-container');
      const status = (await statusElement.count()) > 0
        ? await statusElement.innerText()
        : 'Not Submitted / Available';

      scrapedAssignments.push({
        title: title.trim().replace(/\n/g, ' '),
        dueDate: dueDate.trim().replace(/\n/g, ' '),
        status: status.trim().replace(/\n/g, ' ')
      });
    } catch (error) {
      continue;
    }
  }

  // 6. OUTPUT 1: Visual Table in Terminal Console
  console.log('\n--- SCRAPED ASSIGNMENT DATA ---');
  console.table(scrapedAssignments);

  // 7. OUTPUT 2: Export Data to a local JSON file
  const outputFilename = 'canvas_assignments.json';
  const jsonString = JSON.stringify(scrapedAssignments, null, 2);
  fs.writeFileSync(outputFilename, jsonString, 'utf-8');
  console.log(`\nSuccess! Clean JSON dataset saved locally to: ./${outputFilename}`);

  // 8. OUTPUT 3: Generate a jQuery-powered HTML dashboard
  generateDashboard(scrapedAssignments);
  console.log('Success! Dashboard saved locally to: ./dashboard.html (open it in your browser)');

  await page.waitForTimeout(5000);
  await browser.close();
}

function generateDashboard(assignments) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Canvas Assignments Dashboard</title>
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f5f7; margin: 0; padding: 30px; }
    h1 { color: #2d3b45; }
    #search { padding: 8px; width: 300px; margin-bottom: 16px; border: 1px solid #ccc; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
    th { background: #2d3b45; color: #fff; cursor: pointer; }
    tr:hover { background: #f9f9f9; }
    .status-missing { color: #c0392b; font-weight: bold; }
    .status-submitted { color: #27ae60; font-weight: bold; }
    .status-default { color: #555; }
    #count { margin-bottom: 10px; color: #666; }
  </style>
</head>
<body>
  <h1>Canvas Assignments Dashboard</h1>
  <input type="text" id="search" placeholder="Filter by title or status...">
  <div id="count"></div>
  <table>
    <thead>
      <tr><th data-key="title">Title</th><th data-key="dueDate">Due Date</th><th data-key="status">Status</th></tr>
    </thead>
    <tbody id="assignment-body"></tbody>
  </table>

  <script>
    const assignments = ${JSON.stringify(assignments, null, 2)};

    function statusClass(status) {
      const s = status.toLowerCase();
      if (s.includes('missing')) return 'status-missing';
      if (s.includes('submitted')) return 'status-submitted';
      return 'status-default';
    }

    function render(data) {
      const \$body = \$('#assignment-body');
      \$body.empty();
      data.forEach(function(item) {
        \$body.append(
          \$('<tr>').append(
            \$('<td>').text(item.title),
            \$('<td>').text(item.dueDate),
            \$('<td>').addClass(statusClass(item.status)).text(item.status)
          )
        );
      });
      \$('#count').text(data.length + ' assignment(s)');
    }

    \$(function () {
      render(assignments);

      \$('#search').on('input', function () {
        const query = \$(this).val().toLowerCase();
        const filtered = assignments.filter(function(item) {
          return item.title.toLowerCase().includes(query) ||
                 item.status.toLowerCase().includes(query);
        });
        render(filtered);
      });

      \$('th').on('click', function () {
        const key = \$(this).data('key');
        const sorted = [...assignments].sort(function(a, b) {
          return a[key].localeCompare(b[key]);
        });
        render(sorted);
      });
    });
  </script>
</body>
</html>`;

  fs.writeFileSync('dashboard.html', html, 'utf-8');
}

scrapeALUCanvas();