/**
 * PDF Export — generates a printable scoreboard + bullets PDF.
 *
 * Designed for hole-punching (wide left margin) and notebook storage.
 */
import { jsPDF } from 'jspdf';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const LEFT_MARGIN = 25; // Wide left margin for hole-punching
const RIGHT_MARGIN = 12;
const TOP_MARGIN = 15;

export function exportScoreboardPDF({ G, numPlayers, playerNames, bulletMessages }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - LEFT_MARGIN - RIGHT_MARGIN;
    let y = TOP_MARGIN;

    // --- Header ---
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Michigan Rummy — LWD', LEFT_MARGIN, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, LEFT_MARGIN, y);
    y += 8;

    // --- Scoreboard Table ---
    const names = Array.from({ length: numPlayers }, (_, i) => playerNames?.[i] || playerNames?.[String(i)] || `Player ${i}`);
    const colWidth = Math.min(22, (usableWidth - 14) / numPlayers); // Rd col ~14mm
    const rdColWidth = 14;
    const tableWidth = rdColWidth + colWidth * numPlayers;
    const rowHeight = 5.5;
    const headerHeight = 7;

    // Helper: draw a cell
    const drawCell = (x, w, h, text, opts = {}) => {
        const { bold, fill, align, fontSize, border } = {
            bold: false, fill: null, align: 'center', fontSize: 8, border: true, ...opts
        };
        if (fill) {
            doc.setFillColor(...fill);
            doc.rect(x, y, w, h, 'F');
        }
        if (border !== false) {
            doc.setDrawColor(180);
            doc.rect(x, y, w, h, 'S');
        }
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(0);
        const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
        doc.text(String(text), textX, y + h / 2 + 1.2, { align });
    };

    // Header row
    drawCell(LEFT_MARGIN, rdColWidth, headerHeight, 'Rd', { bold: true, fill: [240, 240, 240] });
    for (let i = 0; i < numPlayers; i++) {
        const x = LEFT_MARGIN + rdColWidth + i * colWidth;
        drawCell(x, colWidth, headerHeight, names[i], { bold: true, fill: [240, 240, 240], fontSize: 7 });
    }
    y += headerHeight;

    // Score rows
    const scoreHistory = G.scoreHistory || [];
    for (let r = 0; r < 13; r++) {
        const roundData = scoreHistory.find(h => h.round === r);
        const isPlayed = !!roundData;

        // Round label with dealer indicator
        const dealerId = r % numPlayers;
        const rdLabel = `${RANKS[r]} (${names[dealerId]?.[0] || dealerId})`;
        drawCell(LEFT_MARGIN, rdColWidth, rowHeight, rdLabel, { fontSize: 7 });

        for (let i = 0; i < numPlayers; i++) {
            const x = LEFT_MARGIN + rdColWidth + i * colWidth;
            if (isPlayed) {
                // Running total up to this round
                let total = 0;
                for (const h of scoreHistory) {
                    if (h.round <= r) total += (h.scores[String(i)] || 0);
                }
                const delta = roundData.scores[String(i)] || 0;
                const isWinner = roundData.winner === String(i);
                const cellText = isWinner ? `${total}` : `${total} +${delta}`;
                drawCell(x, colWidth, rowHeight, cellText, {
                    fontSize: 7,
                    fill: isWinner ? [255, 248, 225] : null,
                });
            } else {
                drawCell(x, colWidth, rowHeight, r === G.round ? '...' : '', { fontSize: 7 });
            }
        }
        y += rowHeight;
    }

    // Total row
    drawCell(LEFT_MARGIN, rdColWidth, headerHeight, 'Total', { bold: true, fill: [230, 230, 230] });
    for (let i = 0; i < numPlayers; i++) {
        const x = LEFT_MARGIN + rdColWidth + i * colWidth;
        const score = G.players[String(i)]?.score ?? G.players[i]?.score ?? 0;
        drawCell(x, colWidth, headerHeight, String(score), { bold: true, fill: [230, 230, 230] });
    }
    y += headerHeight;

    // Rankings row
    if (scoreHistory.length >= 13) {
        const scores = Array.from({ length: numPlayers }, (_, i) => ({
            id: i, score: G.players[String(i)]?.score ?? G.players[i]?.score ?? 0
        }));
        scores.sort((a, b) => a.score - b.score);
        const rankMap = {};
        let rank = 0;
        for (let j = 0; j < scores.length; j++) {
            if (j > 0 && scores[j].score !== scores[j - 1].score) rank = j;
            rankMap[scores[j].id] = rank;
        }
        const medals = ['1st', '2nd', '3rd'];

        drawCell(LEFT_MARGIN, rdColWidth, rowHeight, 'Rank', { bold: true, fontSize: 7 });
        for (let i = 0; i < numPlayers; i++) {
            const x = LEFT_MARGIN + rdColWidth + i * colWidth;
            const r = rankMap[i];
            drawCell(x, colWidth, rowHeight, medals[r] || `${r + 1}th`, {
                bold: r === 0, fontSize: 7,
                fill: r === 0 ? [255, 235, 59] : null,
            });
        }
        y += rowHeight;
    }

    y += 6;

    // --- Bullet List ---
    const bullets = bulletMessages || [];
    if (bullets.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('The Bullet List', LEFT_MARGIN, y);
        y += 6;

        // Group by player
        const byPlayer = {};
        for (const b of bullets) {
            const name = b.playerName || playerNames?.[b.playerID] || `Player ${b.playerID}`;
            if (!byPlayer[name]) byPlayer[name] = [];
            byPlayer[name].push(b);
        }

        for (const [name, playerBullets] of Object.entries(byPlayer)) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(name, LEFT_MARGIN, y);
            y += 4.5;

            for (const b of playerBullets) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
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
