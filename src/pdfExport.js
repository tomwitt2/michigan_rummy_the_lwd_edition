/**
 * PDF Export — generates a printable scoreboard + bullets PDF.
 *
 * Mirrors the on-screen Scoreboard component as closely as possible.
 * Designed for hole-punching (wide left margin) and notebook storage.
 */
import { jsPDF } from 'jspdf';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ORDINAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const LEFT_MARGIN = 25;
const RIGHT_MARGIN = 12;
const TOP_MARGIN = 15;

// Colors matching the UI
const GREEN = [39, 174, 96];       // #27ae60 — round winner superscript
const RED = [231, 76, 60];         // #e74c3c — non-winner superscript
const GOLD_TEXT = [212, 160, 23];   // #d4a017 — winner name/score
const GOLD_BG = [255, 248, 225];    // #fff8e1 — winner column background
const GOLD_BADGE = [241, 196, 15];  // #f1c40f — 1st place badge
const SILVER_BADGE = [189, 195, 199]; // #bdc3c7
const BRONZE_BADGE = [205, 127, 50]; // #cd7f32
const GRAY_BADGE = [224, 224, 224];  // #e0e0e0
const HEADER_BG = [248, 249, 250];   // #f8f9fa
const TOTAL_BG = [238, 238, 238];    // #eee
const BORDER = [221, 221, 221];      // #ddd
const MUTED = [153, 153, 153];       // #999

export function exportScoreboardPDF({ G, numPlayers, playerNames, bulletMessages }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - LEFT_MARGIN - RIGHT_MARGIN;
    let y = TOP_MARGIN;

    // --- Header: Michigan Rummy + LWD stacked names ---
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('MICHIGAN RUMMY', LEFT_MARGIN, y);
    const titleWidth = doc.getTextWidth('MICHIGAN RUMMY');
    const nameX = LEFT_MARGIN + titleWidth + 3;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text('ott', nameX + doc.getTextWidth('L'), y - 4);
    doc.text('ittbrodt', nameX + doc.getTextWidth('W'), y - 1.5);
    doc.text('logolpolski', nameX + doc.getTextWidth('D'), y + 1);
    doc.setFont('helvetica', 'bold');
    doc.text('L', nameX, y - 4);
    doc.text('W', nameX, y - 1.5);
    doc.text('D', nameX, y + 1);

    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(dateStr, LEFT_MARGIN, y);
    y += 6;

    // --- Scoreboard subtitle ---
    const numDecks = Math.ceil(numPlayers / 5);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Scoreboard', LEFT_MARGIN, y);
    const sbWidth = doc.getTextWidth('Scoreboard');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`${numDecks} ${numDecks === 1 ? 'deck' : 'decks'} (${numDecks * 52} cards)`, LEFT_MARGIN + sbWidth + 3, y);
    y += 5;

    // --- Table setup ---
    const names = Array.from({ length: numPlayers }, (_, i) =>
        playerNames?.[i] || playerNames?.[String(i)] || `Player ${i}`);
    const rdColWidth = 16;
    const colWidth = Math.min(28, (usableWidth - rdColWidth) / numPlayers);
    const rowHeight = 7;
    const headerHeight = 10;

    const scoreHistory = G.scoreHistory || [];
    const isGameOver = scoreHistory.length >= 13;

    // Rankings
    let rankings = null;
    if (isGameOver) {
        const scores = Array.from({ length: numPlayers }, (_, i) => ({
            id: i, score: G.players[String(i)]?.score ?? G.players[i]?.score ?? 0,
        }));
        scores.sort((a, b) => a.score - b.score);
        rankings = {};
        let rank = 0;
        for (let j = 0; j < scores.length; j++) {
            if (j > 0 && scores[j].score !== scores[j - 1].score) rank = j;
            rankings[scores[j].id] = rank;
        }
    }

    // Helper: draw cell border
    const cellBorder = (x, w, h) => {
        doc.setDrawColor(...BORDER);
        doc.rect(x, y, w, h, 'S');
    };

    // Helper: fill + border
    const fillCell = (x, w, h, color) => {
        doc.setFillColor(...color);
        doc.rect(x, y, w, h, 'F');
        cellBorder(x, w, h);
    };

    // --- Header row ---
    fillCell(LEFT_MARGIN, rdColWidth, headerHeight, HEADER_BG);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Rd', LEFT_MARGIN + rdColWidth / 2, y + headerHeight / 2 + 1.5, { align: 'center' });

    for (let i = 0; i < numPlayers; i++) {
        const x = LEFT_MARGIN + rdColWidth + i * colWidth;
        const isWinner = isGameOver && rankings?.[i] === 0;
        fillCell(x, colWidth, headerHeight, isWinner ? GOLD_BG : HEADER_BG);

        // Top accent bar for winner
        if (isWinner) {
            doc.setFillColor(...GOLD_BADGE);
            doc.rect(x + 0.3, y + 0.3, colWidth - 0.6, 1, 'F');
        }

        // Player name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...(isWinner ? GOLD_TEXT : [0, 0, 0]));
        const displayName = names[i];
        doc.text(displayName, x + colWidth / 2, y + 4, { align: 'center' });

        // Cards subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        const cards = G.players[String(i)]?.hand?.length ?? G.players[i]?.hand?.length ?? 0;
        doc.text(`${cards} cards`, x + colWidth / 2, y + 7.5, { align: 'center' });
    }
    y += headerHeight;

    // --- Score rows ---
    for (let r = 0; r < 13; r++) {
        const roundData = scoreHistory.find(h => h.round === r);
        const isCurrentRound = G.round === r;
        const isPlayed = !!roundData;
        const dealerId = r % numPlayers;

        // Round cell
        if (isCurrentRound && !isGameOver) {
            doc.setFillColor(255, 249, 196); // #fff9c4
            doc.rect(LEFT_MARGIN, y, rdColWidth, rowHeight, 'F');
        }
        cellBorder(LEFT_MARGIN, rdColWidth, rowHeight);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(RANKS[r], LEFT_MARGIN + 3, y + rowHeight / 2 + 1.3);
        // Dealer initial
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        const dealerInit = names[dealerId]?.[0] || String(dealerId);
        const rankWidth = doc.getTextWidth(RANKS[r]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const rankW = doc.getTextWidth(RANKS[r]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(` (${dealerInit})`, LEFT_MARGIN + 3 + rankW, y + rowHeight / 2 + 1.3);

        // Score cells
        for (let pId = 0; pId < numPlayers; pId++) {
            const x = LEFT_MARGIN + rdColWidth + pId * colWidth;

            // Background
            if (isCurrentRound && !isGameOver) {
                doc.setFillColor(255, 249, 196);
                doc.rect(x, y, colWidth, rowHeight, 'F');
            }
            cellBorder(x, colWidth, rowHeight);

            if (isPlayed) {
                let runningTotal = 0;
                for (let i = 0; i <= r; i++) {
                    const h = scoreHistory.find(hist => hist.round === i);
                    if (h) runningTotal += (h.scores[String(pId)] || 0);
                }
                const roundScore = roundData.scores[String(pId)] || 0;
                const isRoundWinner = roundData.winner === String(pId);

                const cx = x + colWidth / 2;
                const baseY = y + rowHeight / 2 + 1.5;

                // Running total
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(0);
                const totalStr = String(runningTotal);
                const totalW = doc.getTextWidth(totalStr);

                // Superscript
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                const supStr = isRoundWinner ? '0' : `+${roundScore}`;
                const supW = doc.getTextWidth(supStr);

                // Center the combined total+sup
                const gap = 0.5;
                const fullW = totalW + gap + supW;

                // Adjust font back for total
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');

                // Use larger font width measurement
                const totalW2 = doc.getTextWidth(totalStr);
                doc.setFontSize(7);
                const supW2 = doc.getTextWidth(supStr);
                const fullW2 = totalW2 + gap + supW2;
                const startX = cx - fullW2 / 2;

                // Draw total
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0);
                doc.text(totalStr, startX, baseY);

                // Draw superscript
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                if (isRoundWinner) {
                    doc.setTextColor(...GREEN);
                } else {
                    doc.setTextColor(...RED);
                }
                doc.text(supStr, startX + totalW2 + gap, baseY - 2.2);
            } else if (isCurrentRound && !isGameOver) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...MUTED);
                doc.text('...', x + colWidth / 2, y + rowHeight / 2 + 1.3, { align: 'center' });
            }
        }
        y += rowHeight;
    }

    // --- Total row ---
    fillCell(LEFT_MARGIN, rdColWidth, headerHeight, TOTAL_BG);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Total', LEFT_MARGIN + rdColWidth / 2, y + headerHeight / 2 + 1.5, { align: 'center' });

    for (let i = 0; i < numPlayers; i++) {
        const x = LEFT_MARGIN + rdColWidth + i * colWidth;
        const score = G.players[String(i)]?.score ?? G.players[i]?.score ?? 0;
        const isWinner = isGameOver && rankings?.[i] === 0;
        const rank = rankings?.[i];

        fillCell(x, colWidth, headerHeight, isWinner ? GOLD_BG : TOTAL_BG);

        // Score
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...(isWinner ? GOLD_TEXT : [0, 0, 0]));
        const scoreStr = String(score);

        if (isGameOver && rank != null) {
            // Score + badge
            const scoreW = doc.getTextWidth(scoreStr);
            doc.setFontSize(7);
            const label = ORDINAL_LABELS[rank] || `${rank + 1}th`;
            const labelW = doc.getTextWidth(label);
            const badgeW = labelW + 3;
            const badgeH = 4;
            const totalW = scoreW + 2 + badgeW;
            const startX = x + colWidth / 2 - totalW / 2;

            // Draw score
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...(isWinner ? GOLD_TEXT : [0, 0, 0]));
            doc.text(scoreStr, startX, y + headerHeight / 2 + 2);

            // Draw badge pill
            const badgeX = startX + scoreW + 2;
            const badgeY = y + headerHeight / 2 - 1;
            const badgeColor = rank === 0 ? GOLD_BADGE : rank === 1 ? SILVER_BADGE : rank === 2 ? BRONZE_BADGE : GRAY_BADGE;
            doc.setFillColor(...badgeColor);
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(rank <= 2 ? 255 : 100);
            doc.text(label, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1, { align: 'center' });
        } else {
            doc.text(scoreStr, x + colWidth / 2, y + headerHeight / 2 + 2, { align: 'center' });
        }
    }
    y += headerHeight;

    y += 8;

    // --- Bullet List ---
    const bullets = bulletMessages || [];
    if (bullets.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('The Bullet List', LEFT_MARGIN, y);
        y += 6;

        const byPlayer = {};
        for (const b of bullets) {
            const name = b.playerName || playerNames?.[b.playerID] || `Player ${b.playerID}`;
            if (!byPlayer[name]) byPlayer[name] = [];
            byPlayer[name].push(b);
        }

        for (const [name, playerBullets] of Object.entries(byPlayer)) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(name, LEFT_MARGIN, y);
            y += 4.5;

            for (const b of playerBullets) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0);
                const roundLabel = b.round != null ? ` (R${b.round + 1})` : '';
                const line = `\u2022  ${b.text}${roundLabel}`;
                const lines = doc.splitTextToSize(line, usableWidth - 5);
                for (const l of lines) {
                    if (y > 260) {
                        doc.addPage();
                        y = TOP_MARGIN;
                    }
                    doc.text(l, LEFT_MARGIN + 3, y);
                    y += 4;
                }
            }
            y += 3;
        }
    }

    // --- Download ---
    const dateFile = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    doc.save(`lwd-rummy-scoreboard-${dateFile}.pdf`);
}
