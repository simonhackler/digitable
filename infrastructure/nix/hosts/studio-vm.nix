{...}: {
  fileSystems."/" = {
    device = "tmpfs";
    fsType = "tmpfs";
    options = ["mode=755"];
  };

  fileSystems."/boot" = {
    device = "tmpfs";
    fsType = "tmpfs";
    options = ["mode=0755"];
  };

  virtualisation.vmVariant = {
    virtualisation.memorySize = 2048;
    virtualisation.cores = 2;
    virtualisation.forwardPorts = [
      {
        from = "host";
        host.port = 2222;
        guest.port = 22;
      }
      {
        from = "host";
        host.port = 15432;
        guest.port = 5432;
      }
      {
        from = "host";
        host.port = 18080;
        guest.port = 80;
      }
      {
        from = "host";
        host.port = 8443;
        guest.port = 443;
      }
    ];
  };
}
