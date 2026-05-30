import * as vscode from 'vscode';
import { resolveWorkspacePath } from './pathUtils';

export interface MoveDestination {
	name: string;
	rawPath: string;
	resolvedPath: string;
}

/**
 * Loads and validates move destinations from user configuration.
 * Throws clear error messages if validation fails.
 */
export function loadMoveDestinations(): MoveDestination[] {
	const config = vscode.workspace.getConfiguration('vsmemo');
	const destinations = config.get<Record<string, unknown>>('moveDestinations');

	if (!destinations) {
		throw new Error('No preset move destinations are configured.');
	}

	const keys = Object.keys(destinations);
	if (keys.length === 0) {
		throw new Error('No preset move destinations are configured.');
	}

	const result: MoveDestination[] = [];

	for (const key of keys) {
		if (!key || key.trim() === '') {
			throw new Error('Invalid configuration: Destination name cannot be empty.');
		}

		const rawPath = destinations[key];
		if (typeof rawPath !== 'string') {
			throw new Error(`Invalid configuration: Destination path for "${key}" must be a string.`);
		}

		if (rawPath.trim() === '') {
			throw new Error(`Invalid configuration: Destination path for "${key}" cannot be empty.`);
		}

		let resolvedPath: string;
		try {
			resolvedPath = resolveWorkspacePath(rawPath);
		} catch (error) {
			if (error instanceof Error && error.message === 'No workspace folder is open') {
				throw new Error('Move cancelled. No workspace folder is open.');
			}
			throw error;
		}

		result.push({
			name: key,
			rawPath,
			resolvedPath
		});
	}

	return result;
}
