import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const templateUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/5b1f5b2f6_MasterUConnServiceInvoice.pdf";
        
        const response = await fetch(templateUrl);
        const blob = await response.blob();
        
        // Create a File object directly from the blob
        const file = new File([blob], "MasterUConnServiceInvoice.pdf", { type: "application/pdf" });

        // Upload to Private Storage using the File object
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
            file: file
        });

        return Response.json({ 
            message: "Template saved successfully", 
            file_uri: uploadRes.file_uri 
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});