/**
 * Seed clearly-marked demo clients so the coach screens can be seen populated
 * before Phase 3 exists.
 *
 *   node scripts/seed-demo.mjs          insert
 *   node scripts/seed-demo.mjs --clean  remove
 *
 * No auth users are created — demo clients need no logins, which keeps junk out
 * of the auth table. Every row is named "Demo — …" and --clean deletes exactly those.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const PREFIX = "Demo — ";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
};

/** Vivaan's real series from the spreadsheet, so the charts match the mockups. */
const VIVAAN_WEIGHTS = [
  79.5, 79.1, 78.5, 78.5, 78.5, 78.25, 78.2, 78.0, 78.0, 77.95, 79.4, 79.4, 79.0, 79.0, 78.85,
  78.85,
];

function drift(start, perDay, days, noise = 0.25) {
  return Array.from({ length: days }, (_, i) =>
    Number((start + perDay * i + (Math.sin(i * 2.7) * noise)).toFixed(2)),
  );
}

const CLIENTS = [
  {
    name: "Vivaan Menon",
    age: 22,
    height: 183,
    start_weight: 80,
    goal_weight: 75,
    goal_bf: 13,
    split: "ULRULUR",
    weights: VIVAAN_WEIGHTS,
    skip: [],
  },
  {
    name: "Arjun Pillai",
    age: 27,
    height: 176,
    start_weight: 82.5,
    goal_weight: 78,
    goal_bf: 15,
    split: "PPLPPL",
    weights: drift(82.5, -0.025, 16),
    skip: [],
  },
  {
    name: "Dev Sharma",
    age: 24,
    height: 180,
    start_weight: 73.2,
    goal_weight: 80,
    goal_bf: 14,
    split: "ULULUL",
    weights: drift(73.2, 0.09, 16),
    skip: [],
  },
  {
    name: "Meera Krishnan",
    age: 31,
    height: 162,
    start_weight: 65,
    goal_weight: 60,
    goal_bf: 22,
    split: "FBFBFB",
    weights: drift(65, -0.05, 16),
    skip: [0],
  },
  {
    // Off trend — gaining while cutting.
    name: "Rahul Shetty",
    age: 35,
    height: 178,
    start_weight: 89,
    goal_weight: 84,
    goal_bf: 18,
    split: "ULRULUR",
    weights: drift(89, 0.14, 16),
    skip: [0, 1, 2],
  },
  {
    // Gone quiet — last check-in 5 days ago, poor compliance.
    name: "Kavya Nair",
    age: 29,
    height: 158,
    start_weight: 60,
    goal_weight: 55,
    goal_bf: 21,
    split: "ULRULUR",
    weights: drift(60, -0.04, 16),
    skip: [0, 1, 2, 3, 4, 6, 8, 10, 12, 14],
  },
];

async function clean() {
  const { data: clients } = await supabase.from("clients").select("id").like("name", `${PREFIX}%`);
  const ids = (clients ?? []).map((c) => c.id);

  if (!ids.length) {
    console.log("Nothing to clean.");
    return;
  }

  await supabase.from("daily_checkins").delete().in("client_id", ids);
  await supabase.from("measurements").delete().in("client_id", ids);
  await supabase.from("packages").delete().in("client_id", ids);
  await supabase.from("clients").delete().in("id", ids);
  await supabase.from("consultation_clients").delete().like("name", `${PREFIX}%`);

  console.log(`Removed ${ids.length} demo clients and their data.`);
}

async function seed() {
  await clean();

  for (const spec of CLIENTS) {
    const days = spec.weights.length;

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: PREFIX + spec.name,
        email: `${spec.name.split(" ")[0].toLowerCase()}@example.com`,
        phone: "+91 98000 00000",
        age: spec.age,
        height: spec.height,
        start_weight: spec.start_weight,
        current_weight: spec.weights[spec.weights.length - 1],
        goal_weight: spec.goal_weight,
        goal_bf: spec.goal_bf,
        split: spec.split,
        status: "active",
        start_date: daysAgo(days - 1),
        notes: "Seeded demo client. Safe to delete.",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`${spec.name}: ${error.message}`);
      continue;
    }

    const rows = [];
    for (let i = 0; i < days; i++) {
      const offset = days - 1 - i; // 0 = today
      if (spec.skip.includes(offset)) continue;

      rows.push({
        client_id: client.id,
        date: daysAgo(offset),
        weight: spec.weights[i],
        steps: 6500 + Math.round(Math.abs(Math.sin(i * 1.3)) * 4500),
        calories: offset === 4 ? null : 2400 + Math.round(Math.abs(Math.cos(i)) * 200),
        supplements_taken: offset !== 1,
        sleep_time: "00:30",
        sleep_duration_hrs: Number((6.5 + Math.abs(Math.sin(i * 0.9)) * 2.5).toFixed(1)),
        sleep_quality: 6 + (i % 4),
        water_intake_l: 3.5 + (i % 2) * 0.5,
        hunger: 4 + (i % 4),
        digestion_issues: i % 7 === 3,
        stress: 4 + (i % 5),
        lyfta_link: i % 3 === 2 ? null : `https://lyfta.app/wk/demo${i}`,
      });
    }

    await supabase.from("daily_checkins").insert(rows);

    await supabase.from("measurements").insert({
      client_id: client.id,
      date: daysAgo(days - 1),
      arms_right: 15, arms_left: 15, shoulders: 51,
      chest: 41, waist: 36, hip: 57, right_thigh: 23, left_thigh: 23,
    });

    console.log(`${PREFIX}${spec.name}: ${rows.length}/${days} check-ins`);
  }

  await supabase.from("packages").insert([
    { client_id: (await idFor("Dev Sharma")), sessions_purchased: 24, sessions_remaining: 1, price: 48000 },
    { client_id: (await idFor("Arjun Pillai")), sessions_purchased: 12, sessions_remaining: 2, price: 24000 },
  ]);

  await supabase.from("consultation_clients").insert([
    {
      name: PREFIX + "Priya Raghavan",
      email: "priya@example.com",
      phone: "+91 98842 20114",
      status: "new",
      form_responses: {
        Age: "29",
        Height: "164 cm",
        "Current weight": "71 kg",
        "Goal weight": "61 kg",
        "Primary goal": "Fat loss",
        "Days available per week": "4",
        "Dietary preference": "Vegetarian",
        "Injuries or medical conditions": "Mild PCOS, lower back stiffness from desk work.",
      },
    },
    {
      name: PREFIX + "Sanjay Iyer",
      email: "sanjay@example.com",
      phone: "+91 90000 11111",
      status: "new",
      form_responses: { Age: "34", "Primary goal": "Muscle gain", "Days available per week": "5" },
    },
  ]);

  console.log("Seeded packages and consultations.");
}

async function idFor(name) {
  const { data } = await supabase.from("clients").select("id").eq("name", PREFIX + name).single();
  return data?.id;
}

if (process.argv.includes("--clean")) {
  await clean();
} else {
  await seed();
}
