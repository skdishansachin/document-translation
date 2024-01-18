// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import crypto from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";

interface contentItem {
	status: string;
	inputText: string;
	outputText: string;
}

interface event {
	jobStatus: string;
	id: string;
	content: contentItem[];
}

const { Sha256: Sha256 } = crypto;
const API_ENDPOINT: string | undefined = process.env.API_ENDPOINT || undefined;
const API_REGION: string | undefined = process.env.API_REGION || undefined;
const API_QUERY: string | undefined = process.env.API_QUERY || undefined;

export const handler = async (event: event) => {
	if (!API_ENDPOINT) {
		throw new Error("Missing API_ENDPOINT");
	}
	if (!API_REGION) {
		throw new Error("Missing API_REGION");
	}
	if (!API_QUERY) {
		throw new Error("Missing GRAPHQL_QUERY");
	}

	const query = /* GraphQL */ `
		${API_QUERY}
	`;
	const variables = event;
	const requestBody = JSON.stringify({ query: query, variables: variables });

	const endpoint = new URL(API_ENDPOINT);

	const signer: SignatureV4 = new SignatureV4({
		credentials: defaultProvider(),
		region: API_REGION,
		service: "appsync",
		sha256: Sha256,
	});

	const requestToBeSigned = new HttpRequest({
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			host: endpoint.host,
		},
		hostname: endpoint.host,
		body: requestBody,
		path: endpoint.pathname,
	});

	const signed = await signer.sign(requestToBeSigned);
	const request = new Request(API_ENDPOINT, signed);

	let responseBody;
	try {
		const response = await fetch(request);
		responseBody = await response.json();
		if (responseBody.errors) {
			responseBody.errors.every(function (error) {
				console.error(error);
			});
			throw new Error(JSON.stringify(responseBody.errors));
		}
	} catch (error) {
		console.error(error);
		throw new Error(JSON.stringify(error));
	}

	return {
		statusCode: 200,
		body: JSON.stringify(responseBody),
	};
};
