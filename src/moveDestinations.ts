import * as vscode from 'vscode';
import { getWorkspacePath, resolveWorkspacePath } from './pathUtils';

export interface ConfiguredMoveDestination {
	name: string;
	rawPath: string;
}

export interface MoveDestination extends ConfiguredMoveDestination {
	resolvedPath: string;
}

/**
 * Loads and validates move destinations from user configuration.
 * Throws clear error messages if validation fails.
 */
export function loadConfiguredMoveDestinations(resource?: vscode.Uri): ConfiguredMoveDestination[] {
	const config = vscode.workspace.getConfiguration('vsmemo', resource);
	const destinations = config.get<Record<string, unknown>>('moveDestinations');

	if (!destinations) {
		throw new Error('No preset move destinations are configured.');
	}

	const keys = Object.keys(destinations);
	if (keys.length === 0) {
		throw new Error('No preset move destinations are configured.');
	}

	const result: ConfiguredMoveDestination[] = [];

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

		result.push({ name: key, rawPath });
	}

	return result;
}

export function loadMoveDestinations(resource?: vscode.Uri, workspacePath: string | null | undefined = getWorkspacePath(resource)): MoveDestination[] {
	return loadConfiguredMoveDestinations(resource).map(destination => {
		try {
			return { ...destination, resolvedPath: resolveWorkspacePath(destination.rawPath, workspacePath) };
		} catch (error) {
			if (error instanceof Error && error.message === 'No workspace folder is open') {
				throw new Error('Move cancelled. No workspace folder is open.');
			}
			throw error;
		}
	});
}
