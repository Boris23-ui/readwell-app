// ReadWell Content Script

let currentSelection = '';
let tooltip: HTMLDivElement | null = null;

// Initialize tooltip
function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'readwell-tooltip';
  tooltip.innerHTML = `
    <button id="readwell-quiz-btn">Quiz Me</button>
  `;
  document.body.appendChild(tooltip);

  tooltip.querySelector('#readwell-quiz-btn')?.addEventListener('click', async () => {
    if (currentSelection) {
      alert(`Generating quiz for: "${currentSelection.substring(0, 50)}..."`);
      
      // We would send this to the backend /api/quiz/generate here
      try {
        const response = await fetch('http://localhost:3000/api/quiz/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ passage: currentSelection })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('ReadWell Quiz generated:', data);
          alert('Quiz generated successfully! Check console.');
        } else {
          alert('Failed to generate quiz.');
        }
      } catch (e) {
        console.error('ReadWell Extension error:', e);
        alert('Network error communicating with ReadWell backend.');
      }
      
      hideTooltip();
    }
  });
}

function showTooltip(x: number, y: number) {
  if (!tooltip) createTooltip();
  if (tooltip) {
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y - 40}px`; // Show above the cursor
    tooltip.classList.add('visible');
  }
}

function hideTooltip() {
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  
  if (text && text.length > 20) {
    currentSelection = text;
    showTooltip(e.pageX, e.pageY);
  } else {
    currentSelection = '';
    hideTooltip();
  }
});
