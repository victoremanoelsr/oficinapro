using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

internal static class Program
{
    private static void WriteResource(string name, string destination)
    {
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        using (FileStream output = File.Create(destination))
        {
            if (input == null) throw new InvalidOperationException("Recurso de atualização não encontrado.");
            input.CopyTo(output);
        }
    }

    [STAThread]
    private static void Main()
    {
            string work = Path.Combine(Path.GetTempPath(), "OficinaProUpdate196-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(work);
            WriteResource("OficinaPro.Payload", Path.Combine(work, "payload-v1.9.6.zip"));
            WriteResource("OficinaPro.Install", Path.Combine(work, "install.ps1"));
            ProcessStartInfo start = new ProcessStartInfo("powershell.exe", "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File install.ps1");
            start.WorkingDirectory = work;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            using (Process process = Process.Start(start))
            {
                process.WaitForExit();
                if (process.ExitCode != 0) throw new InvalidOperationException("A atualização não foi concluída. Código: " + process.ExitCode);
            }
            MessageBox.Show("Oficina Pro atualizado para a versão 1.9.6. Seus dados foram preservados.", "Atualização concluída", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception error)
        {
            MessageBox.Show("Não foi possível atualizar o Oficina Pro.\n\n" + error.Message, "Erro na atualização", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            try { Directory.Delete(work, true); } catch { }
        }
    }
}
