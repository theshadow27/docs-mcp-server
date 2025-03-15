import { MinimumChunkSizeError } from "../errors.js";
import type {
	ContentChunk,
	ContentSplitter,
	ContentSplitterOptions,
} from "./types.js";

/**
 * Interface representing the structure of a parsed markdown table
 */
interface ParsedTable {
	headers: string[];
	separator: string;
	rows: string[];
}

/**
 * Splits table content while preserving headers and table formatting.
 * Each chunk maintains the table structure with headers and separator row.
 */
export class TableContentSplitter implements ContentSplitter {
	constructor(private options: ContentSplitterOptions) {}

	/**
	 * Splits table content into chunks while preserving table structure
	 */
	async split(
		content: string,
		metadata?: { headers?: string[] },
	): Promise<ContentChunk[]> {
		const parsedTable = this.parseTable(content);
		if (!parsedTable) {
			return [{ content, metadata }];
		}

		// Check if a single row with headers exceeds maxChunkSize
		if (
			parsedTable.rows.length > 0 &&
			this.wrap(parsedTable.rows[0], { headers: parsedTable.headers }).length >
				this.options.maxChunkSize
		) {
			const rowSize = this.wrap(parsedTable.rows[0], {
				headers: parsedTable.headers,
			}).length;
			throw new MinimumChunkSizeError(rowSize, this.options.maxChunkSize);
		}

		const { headers, rows } = parsedTable;

		const chunks: ContentChunk[] = [];
		let currentRows: string[] = [];

		for (const row of rows) {
			const newChunkContent = this.wrap([...currentRows, row].join("\n"), {
				headers,
			});
			const newChunkSize = newChunkContent.length;
			if (newChunkSize > this.options.maxChunkSize && currentRows.length > 0) {
				// Add current chunk, start new
				chunks.push({
					content: this.wrap(currentRows.join("\n"), { headers }),
					metadata: { headers },
				});
				currentRows = [row];
			} else {
				currentRows.push(row);
			}
		}

		if (currentRows.length > 0) {
			chunks.push({
				content: this.wrap(currentRows.join("\n"), { headers }),
				metadata: { headers },
			});
		}

		// No merging of table chunks
		return chunks;
	}

	protected wrap(content: string, metadata?: { headers?: string[] }): string {
		if (!metadata || !metadata.headers) {
			return content;
		}
		const headerRow = `| ${metadata.headers.join(" | ")} |`;
		const separatorRow = `|${metadata.headers.map(() => "---").join("|")}|`;
		return [headerRow, separatorRow, content].join("\n");
	}

	private parseTable(content: string): ParsedTable | null {
		const lines = content.trim().split("\n");
		if (lines.length < 3) return null; // Need at least headers, separator, and one data row

		const headers = this.parseRow(lines[0]);
		if (!headers) return null;

		const separator = lines[1];
		if (!this.isValidSeparator(separator)) return null;

		const rows = lines.slice(2).filter((row) => row.trim() !== "");

		return { headers, separator, rows };
	}

	/**
	 * Parses a table row into cells
	 */
	private parseRow(row: string): string[] | null {
		if (!row.includes("|")) return null;
		return row
			.split("|")
			.map((cell) => cell.trim())
			.filter((cell) => cell !== "");
	}

	/**
	 * Validates the separator row of the table
	 */
	private isValidSeparator(separator: string): boolean {
		return separator.includes("|") && /^\|?[\s-|]+\|?$/.test(separator);
	}
}
