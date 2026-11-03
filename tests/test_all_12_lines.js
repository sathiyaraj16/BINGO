const assert = require('assert');

// 12 Line Definitions for 5x5 grid
const lineDefinitions = [
  // 5 Rows
  { id: 'row-0', type: 'row', index: 0, indices: [0, 1, 2, 3, 4] },
  { id: 'row-1', type: 'row', index: 1, indices: [5, 6, 7, 8, 9] },
  { id: 'row-2', type: 'row', index: 2, indices: [10, 11, 12, 13, 14] },
  { id: 'row-3', type: 'row', index: 3, indices: [15, 16, 17, 18, 19] },
  { id: 'row-4', type: 'row', index: 4, indices: [20, 21, 22, 23, 24] },

  // 5 Columns
  { id: 'col-0', type: 'col', index: 0, indices: [0, 5, 10, 15, 20] },
  { id: 'col-1', type: 'col', index: 1, indices: [1, 6, 11, 16, 21] },
  { id: 'col-2', type: 'col', index: 2, indices: [2, 7, 12, 17, 22] },
  { id: 'col-3', type: 'col', index: 3, indices: [3, 8, 13, 18, 23] },
  { id: 'col-4', type: 'col', index: 4, indices: [4, 9, 14, 19, 24] },

  // 2 Diagonals
  { id: 'diag-main', type: 'diag', index: 0, indices: [0, 6, 12, 18, 24] },
  { id: 'diag-anti', type: 'diag', index: 1, indices: [4, 8, 12, 16, 20] }
];

function checkCompletedLines(player) {
  const newlyCompleted = [];
  for (const lineDef of lineDefinitions) {
    if (player.completedLines.includes(lineDef.id)) {
      continue;
    }
    const isComplete = lineDef.indices.every(idx => player.marked[idx] === true);
    if (isComplete) {
      newlyCompleted.push(lineDef);
    }
  }
  return newlyCompleted;
}

console.log('--- Testing All 12 Line Definitions Independently ---');

// Test all 5 rows
for (let r = 0; r < 5; r++) {
  const player = { marked: new Array(25).fill(false), completedLines: [] };
  lineDefinitions[r].indices.forEach(idx => player.marked[idx] = true);
  const completed = checkCompletedLines(player);
  assert.strictEqual(completed.length, 1, `Row ${r} must complete exactly 1 line`);
  assert.strictEqual(completed[0].id, `row-${r}`, `Completed line must be row-${r}`);
  console.log(`✓ Row ${r} [${lineDefinitions[r].indices.join(', ')}] correctly detected.`);
}

// Test all 5 columns
for (let c = 0; c < 5; c++) {
  const colDef = lineDefinitions[5 + c];
  const player = { marked: new Array(25).fill(false), completedLines: [] };
  colDef.indices.forEach(idx => player.marked[idx] = true);
  const completed = checkCompletedLines(player);
  assert.strictEqual(completed.length, 1, `Col ${c} must complete exactly 1 line`);
  assert.strictEqual(completed[0].id, `col-${c}`, `Completed line must be col-${c}`);
  console.log(`✓ Column ${c} [${colDef.indices.join(', ')}] correctly detected.`);
}

// Test Diagonal Main (\)
{
  const diagDef = lineDefinitions[10];
  const player = { marked: new Array(25).fill(false), completedLines: [] };
  diagDef.indices.forEach(idx => player.marked[idx] = true);
  const completed = checkCompletedLines(player);
  assert.strictEqual(completed.length, 1, 'Main diagonal must complete exactly 1 line');
  assert.strictEqual(completed[0].id, 'diag-main');
  console.log(`✓ Main Diagonal [${diagDef.indices.join(', ')}] correctly detected.`);
}

// Test Diagonal Anti (/)
{
  const diagDef = lineDefinitions[11];
  const player = { marked: new Array(25).fill(false), completedLines: [] };
  diagDef.indices.forEach(idx => player.marked[idx] = true);
  const completed = checkCompletedLines(player);
  assert.strictEqual(completed.length, 1, 'Anti diagonal must complete exactly 1 line');
  assert.strictEqual(completed[0].id, 'diag-anti');
  console.log(`✓ Anti Diagonal [${diagDef.indices.join(', ')}] correctly detected.`);
}

// Test Duplicate Prevention
{
  const player = { marked: new Array(25).fill(false), completedLines: ['row-0'] };
  [0, 1, 2, 3, 4].forEach(idx => player.marked[idx] = true);
  const completed = checkCompletedLines(player);
  assert.strictEqual(completed.length, 0, 'Already counted row-0 must not be counted again');
  console.log('✓ Duplicate line prevention verified.');
}

console.log('\n======================================================');
console.log(' ALL 12 LINE DETECTION TESTS PASSED! 🎉');
console.log('======================================================');
