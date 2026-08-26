import { uploadDocumentAction } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getPatientWorkspace } from '@/lib/dal';
import { formatBytes, formatDateTime } from '@/lib/format';

export default async function DocumentsPage() {
  const data = await getPatientWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Your medical records</h1>
        <p className="text-muted-foreground text-sm">
          Keep reports, prescriptions, and discharge summaries in one place.
        </p>
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>Upload record</CardTitle>
            <CardDescription>PDF, JPG, or PNG under 10MB.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadDocumentAction} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input id="title" name="title" placeholder="CBC report" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="docType">Document type</FieldLabel>
                  <Select id="docType" name="docType" defaultValue="lab">
                    <option value="lab">Lab report</option>
                    <option value="rx">Prescription</option>
                    <option value="discharge">Discharge summary</option>
                    <option value="note">Clinical note</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="file">File</FieldLabel>
                  <Input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notes</FieldLabel>
                  <Textarea id="notes" name="notes" placeholder="Optional context for the doctor" />
                </Field>
                <Button type="submit">Add record</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle>Saved records</CardTitle>
            <CardDescription>Your records are ready when you need to share them.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Uploaded medical document metadata.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pe-6 text-right">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.documents.map(({ document }) => (
                  <TableRow className="h-12" key={document.id}>
                    <TableCell className="max-w-48 ps-6">
                      <p className="truncate font-medium">{document.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{document.fileName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{document.docType}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatBytes(document.fileSizeBytes)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={document.status === 'processed' ? 'success' : 'secondary'}>
                        {document.status === 'processed' ? 'Ready' : 'Being prepared'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground pe-6 text-right">
                      {formatDateTime(document.uploadedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
