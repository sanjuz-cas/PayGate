import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { Address } from "@juicebag-mail/shared";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: "Times-Roman",
  },
  heading: {
    fontSize: 16,
    marginBottom: 24,
  },
  block: {
    marginBottom: 16,
  },
  subject: {
    fontSize: 13,
    marginBottom: 12,
  },
});

function AddressBlock({ address }: { address: Address }) {
  return (
    <View style={styles.block}>
      <Text>{address.name}</Text>
      <Text>{address.street1}</Text>
      {address.street2 ? <Text>{address.street2}</Text> : null}
      <Text>
        {address.postalCode} {address.city}
      </Text>
      <Text>{address.country}</Text>
    </View>
  );
}

export async function renderOutboundLetterPdf(input: {
  mailboxName: string;
  recipient: Address;
  subject: string;
  bodyMarkdown: string;
  createdAt: string;
}) {
  const bodyLines = input.bodyMarkdown.split(/\r?\n/);

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>Juicebag Mail Outbound Letter</Text>
        <View style={styles.block}>
          <Text>From: {input.mailboxName}</Text>
          <Text>Generated: {new Date(input.createdAt).toLocaleString("en-US")}</Text>
        </View>
        <AddressBlock address={input.recipient} />
        <Text style={styles.subject}>Subject: {input.subject}</Text>
        <View style={styles.block}>
          {bodyLines.map((line, index) => (
            <Text key={`${index}-${line}`}>{line || " "}</Text>
          ))}
        </View>
      </Page>
    </Document>,
  );
}
