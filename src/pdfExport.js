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
    doc.text('MICHIGAN RUMMY', LEFT_MARGIN, y);
    const titleWidth = doc.getTextWidth('MICHIGAN RUMMY');
    const nameX = LEFT_MARGIN + titleWidth + 3;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Lott', nameX, y - 4);
    doc.text('Wittbrodt', nameX, y - 1.5);
    doc.text('Dlogolpolski', nameX, y + 1);
    doc.setFont('helvetica', 'bold');
    doc.text('L', nameX, y - 4);
    doc.text('W', nameX, y - 1.5);
    doc.text('D', nameX, y + 1);
    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, LEFT_MARGIN, y);
    y += 8;

    // --- Scoreboard Table ---
    const names = Array.from({ length: numPlayers }, (_, i) => playerNames?.[i] || playerNames?.[String(i)] || `Player ${i}`);
    const colWidth = Math.min(22, (usableWidth - 14) / numPlayers);
    const rdColWidth = 14;
    const rowHeight = 6;
    const headerHeight = 7;

    // Helper: draw cell background and border
    const drawCellBg = (x, w, h, fill) => {
        if (fill) {
            doc.setFillColor(...fill);
            doc.rect(x, y, w, h, 'F');
        }
        doc.setDrawColor(180);
        doc.rect(x, y, w, h, 'S');
    };

    // Helper: draw simple text cell
    const drawCell = (x, w, h, text, opts = {}) => {
        const { bold, fill, align, fontSize } = {
            bold: false, fill: null, align: 'center', fontSize: 8, ...opts
        };
        drawCellBg(x, w, h, fill);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(0);
        const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
        doc.text(String(text), textX, y + h / 2 + 1.2, { align });
    };

    // Helper: draw score cell with running total + colored superscript delta
    const drawScoreCell = (x, w, h, total, delta, isWinner) => {
        const fill = isWinner ? [234, 250, 241] : null; // light green for winner
        drawCellBg(x, w, h, fill);

        const centerX = x + w / 2;
        const baseY = y + h / 2 + 1.2;

        // Main score (running total)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0);
        const totalStr = String(total);
        const totalWidth = doc.getTextWidth(totalStr);

        if (isWinner) {
            // Winner: show total in green, no delta (delta is 0)
            doc.setTextColor(39, 174, 96); // green
            doc.text(totalStr, centerX, baseY, { align: 'center' });
        } else {
            // Non-winner: total + superscript delta
            const deltaStr = `+${delta}`;
            doc.setFontSize(5.5);
            const deltaWidth = doc.getTextWidth(deltaStr);
            const fullWidth = totalWidth + 1 + deltaWidth;
            const startX = centerX - fullWidth / 2;

            // Draw total
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(totalStr, startX, baseY);

            // Draw delta as superscript in red
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(200, 50, 50); // red
            doc.text(deltaStr, startX + totalWidth + 0.8, baseY - 1.8);
        }
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
                let total = 0;
                for (const h of scoreHistory) {
                    if (h.round <= r) total += (h.scores[String(i)] || 0);
                }
                const delta = roundData.scores[String(i)] || 0;
                const isWinner = roundData.winner === String(i);
                drawScoreCell(x, colWidth, rowHeight, total, delta, isWinner);
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
