const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

const to = new Date();
const from = new Date();
from.setDate(from.getDate() - 30);

const query = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function main() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { login: USERNAME, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  const days = json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .slice(-30);

  const max = Math.max(1, ...days.map((d) => d.contributionCount));

  const width = 900;
  const height = 220;
  const padding = 40;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const barGap = 4;
  const barW = (chartW - barGap * (days.length - 1)) / days.length;

  const bars = days
    .map((d, i) => {
      const h = Math.max(3, (d.contributionCount / max) * chartH);
      const x = padding + i * (barW + barGap);
      const y = height - padding - h;
      const color =
        d.contributionCount === 0
          ? "#3d2a70"
          : d.contributionCount === max
          ? "#FFE94A"
          : "#5FE0FF";
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(
        1
      )}" height="${h.toFixed(1)}" fill="${color}"/>`;
    })
    .join("\n");

  const svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
<defs>
  <linearGradient id="pulsebg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#170833"/>
    <stop offset="100%" stop-color="#0c0620"/>
  </linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="url(#pulsebg)"/>
<rect x="0" y="0" width="${width}" height="4" fill="#FFE94A"/>
<rect x="0" y="${height - 4}" width="${width}" height="4" fill="#FFE94A"/>
<rect x="0" y="0" width="4" height="${height}" fill="#FFE94A"/>
<rect x="${width - 4}" y="0" width="4" height="${height}" fill="#FFE94A"/>
<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${
    height - padding
  }" stroke="#3d2a70" stroke-width="2"/>
${bars}
<rect x="${padding}" y="16" width="2" height="${chartH + 4}" fill="#5FE0FF" opacity="0.5">
  <animate attributeName="x" values="${padding};${width - padding};${padding}" dur="8s" repeatCount="indefinite"/>
</rect>
</svg>`;

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync(path.join("dist", "monthly-pulse.svg"), svg);
  console.log(`monthly-pulse.svg generated: ${days.length} days, max = ${max}`);
}

main();
