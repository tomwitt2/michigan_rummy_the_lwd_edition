🃏 Family-Deck Project & AI Workflow Master Reference
1. The Core Project: Remote Card Engine
Primary Engine: boardgame.io (State sync + Multiplayer logic).

Alternative: PlayingCards.io (Sandbox feel) or CardHouse (Unity/3D).

Tech Stack: React, Node.js, Docker, AWS (Fargate/EC2).

2. Tooling Strategy (gCli vs. ag)
Gemini-CLI (gCli)
Role: The "Tactical Assistant."

Best For: Terminal-native tasks, SSH remote sessions, quick logic fixes, and CI/CD automation.

Workflow: Uses GEMINI.md in the current directory as its brain.

Key Command: gemini --resume (Picks up exactly where you left off in that folder).

Antigravity (ag)
Role: The "Strategic Architect."

Best For: Scaffolding the entire app, UI/UX visual testing, and complex multi-file refactoring.

Workflow: Uses the .agent/ directory to store "Implementation Plans" and long-term memory.

Key Feature: The Agent Manager handles autonomous task execution.

The Hybrid Loop
Architect the project and UI in Antigravity.

Maintain and debug via Gemini-CLI while in the terminal or on remote servers.

Sync both using the GEMINI.md file as the "Source of Truth."

3. Directory & Context Management
Structure: ~/dev-gemini/

.global-rules.md: Stores persistent preferences (Linux/AWS/Node).

[project-name]/GEMINI.md: Stores project-specific "Active Missions."

The "Safe Switch" Protocol
Before jumping to a new task:

Run: gemini "Update GEMINI.md with current progress and next steps."

cd to the new project.

Run: gemini --resume to wake up the AI in the new context.

4. Initial "Family-Deck" Mission
[ ] Initialize boardgame.io server.

[ ] Define 52-card deck and "Shuffle" move in src/game/logic.js.

[ ] Setup Dockerfile for Kubuntu/Debian deployment.

[ ] Deploy a "Hello World" spectator view to AWS.

