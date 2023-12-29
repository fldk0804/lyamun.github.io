const bubbleContainer = document.querySelector(".bubble-container");

function makeRows() {
	// Clean up any rows/bubbles created when button was previously clicked
	bubbleContainer.innerHTML = "";
	// Make rows to hold bubbles
	for (i = 0; i < 5; i++) {
		row = document.createElement("div");
		row.classList.add("bubble-row");
		// Make bubbles for this row at random positions horizontally
		for (j = 0; j < 3; j++) {
			const randNum = Math.floor(Math.random() * 100);
			const randDelay = Math.floor(Math.random() * 3);
			const randDuration = Math.floor(Math.random() * 10 + 3);

			bubble = document.createElement("div");
			bubble.classList.add("bubble");
			bubble.style.setProperty("--positionX", randNum + "%");
			bubble.style.setProperty("--animation-delay", randDelay + "s");
			bubble.style.setProperty("--animation-duration", randDuration + "s");
			// Add some variety in size of bubbles
			if (j == 1) {
				bubble.classList.add("sm");
			} else if (j == 2) {
				bubble.classList.add("md");
			} else {
				bubble.classList.add("lg");
			}

			row.appendChild(bubble);
		}
		bubbleContainer.appendChild(row);
	}
}
//Don't call the function here! The animation will run when button is clicked.
//makeRows();
