import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dialect = "mysql" } = body;

    if (dialect === "sqlite") {
      const file = (body.file as string)?.trim() || "data/pixxelai.db";
      const resolved = path.resolve(process.cwd(), file);
      const cwd = process.cwd();
      const outsideProject = resolved !== cwd && !resolved.startsWith(cwd + path.sep);
      if (path.isAbsolute(file) || outsideProject) {
        return NextResponse.json(
          { success: false, error: "Database file path must be a relative path within the project directory." },
          { status: 400 }
        );
      }
      try {
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.accessSync(dir, fs.constants.W_OK);
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Path is not writable.";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    }

    const { host, port, user, password, name } = body;

    if (!host || !user || !name) {
      return NextResponse.json(
        { success: false, error: "Host, username, and database name are required." },
        { status: 400 }
      );
    }

    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host: host.trim(),
        port: Number(port) || 3306,
        user: user.trim(),
        password: password ?? "",
        connectTimeout: 8000,
      });

      // Verify or create the database
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${name.trim()}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Database connection failed.";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

